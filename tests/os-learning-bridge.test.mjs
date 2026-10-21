import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import express from 'express'
import {buildOsLearningPack,registerOsLearningBridge,MAX_LEARNING_BYTES} from '../server/osLearningBridge.js'
const policy=featureKey=>({featureKey,status:'active',version:'fixture-v1',systemPrompt:'확인한 사실만 사용',rules:'가상 자료를 실적으로 표시하지 않음',attachments:[{id:'a',text:'클렌징 제품. 고객의 저녁 루틴을 기준으로 근거를 제시한다.\n\n관련 없는 장난감 내용.'}]})
const configs=['creator-recommendation','content-guide','campaign-strategy'].map(policy)
test('active policy versions, exact file hashes and bounded relevant excerpts are pinned without full-library claims',()=>{
 const pack=buildOsLearningPack(configs,{query:'클렌징 저녁',stage:'strategy'}),{fingerprint,...body}=pack
 assert.equal(fingerprint,createHash('sha256').update(JSON.stringify(body)).digest('hex'))
 assert.equal(pack.policies.length,3);assert.equal(pack.policies[0].materials[0].sha256,createHash('sha256').update(configs[0].attachments[0].text).digest('hex'))
 assert.equal(pack.retrieval.completeLibraryRead,false);assert.ok(pack.retrieval.excerpts[0].score>0)
 const changed=structuredClone(configs);changed[0].rules+=' 수정';assert.notEqual(buildOsLearningPack(changed).fingerprint,buildOsLearningPack(configs).fingerprint)
 assert.throws(()=>buildOsLearningPack(configs.map(c=>({...c,status:'draft'}))),e=>e.status===409)
 assert.throws(()=>buildOsLearningPack(configs,{stage:'outreach'}),e=>e.status===400)
 assert.throws(()=>buildOsLearningPack(configs.map(c=>({...c,systemPrompt:'x'.repeat(30000)}))),e=>e.status===409)
 const large=configs.map(c=>({...c,attachments:Array.from({length:20},(_,i)=>({id:'a'+i,text:('클렌징 제품 지침 '+i+'\n').repeat(500)}))}))
 assert.ok(Buffer.byteLength(JSON.stringify(buildOsLearningPack(large,{query:'클렌징'})))<=MAX_LEARNING_BYTES+100)
})
test('service route requires its own secret, rejects arbitrary reads and source failures, and never invokes a model',async()=>{
 const app=express();app.use(express.json());let reads=0,fail=false
 registerOsLearningBridge(app,{env:{CREATOROPS_OS_TOKEN:'fixture-'.repeat(5)},loadActiveConfigs:async()=>{reads++;if(fail)throw Error('sensitive database error');return configs}})
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url='http://127.0.0.1:'+server.address().port+'/os-bridge/v1/learning'
 try{
  let r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.equal(r.status,401);assert.equal(reads,0)
  const send=body=>fetch(url,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+'fixture-'.repeat(5)},body:JSON.stringify(body)})
  r=await send({stage:'guide',query:'클렌징'});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal((await r.json()).policies.length,2)
  r=await send({stage:'guide',query:'클렌징',workspaceId:'foreign'});assert.equal(r.status,400)
  fail=true;r=await send({stage:'guide'});assert.equal(r.status,503);assert.ok(!(await r.text()).includes('sensitive'))
 }finally{await new Promise(r=>server.close(r))}
})
