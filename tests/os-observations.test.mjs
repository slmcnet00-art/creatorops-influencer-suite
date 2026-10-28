import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import {memorySupabase} from './helpers/memorySupabase.mjs'
import {registerOsObservations} from '../server/osObservations.js'
import {buildOsLearningPack} from '../server/osLearningBridge.js'

test('native observation is scoped pure SELECT; OS-only execution has no fabricated native calls',async t=>{
 const client=memorySupabase({ai_generation_runs:[]}),before=JSON.stringify(client.tables),env={CREATOROPS_OBSERVATION_READ_TOKEN:'fixture-read-'.repeat(4),CREATOROPS_OBSERVATION_PROJECT_IDS:'p'}
 let state='approved';const app=express();registerOsObservations(app,{getClient:()=>client,workspaceId:'w',env,observePrinciples:async()=>({states:[{id:'rule',version:2,status:state}]})})
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>server.close());
 const root='http://127.0.0.1:'+server.address().port+'/os-bridge/v1/observations/',h={authorization:'Bearer '+env.CREATOROPS_OBSERVATION_READ_TOKEN}
 assert.equal((await fetch(root+'runs?project_id=p&os_run_id=r')).status,401)
 assert.equal((await fetch(root+'runs?project_id=foreign&os_run_id=r',{headers:h})).status,403)
 let r=await fetch(root+'runs?project_id=p&os_run_id=r',{headers:h});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.deepEqual((await r.json()).events,[])
 assert.equal((await fetch(root+'runs?project_id=p&os_run_id=r&limit=51',{headers:h})).status,400)
 r=await fetch(root+'principles?project_id=p&os_run_id=r',{headers:h});assert.equal((await r.json()).states[0].status,'approved')
 state='revoked';r=await fetch(root+'principles?project_id=p&os_run_id=r',{headers:h});assert.equal((await r.json()).states[0].status,'revoked')
 assert.equal(JSON.stringify(client.tables),before)
})

test('only approved decision instructions are fingerprinted into the bounded learning pack',()=>{
 const configs=['creator-recommendation','content-guide'].map(featureKey=>({featureKey,status:'active',version:'v1',rules:'Known facts only'}))
 const memory={revision:2,rules:[{id:'rule',version:2,featureKey:'content-guide',instruction:'Use verified product facts'}]}
 const pinned=buildOsLearningPack(configs,{},memory);assert.equal(pinned.decisionPrinciples.rules[0].instruction,memory.rules[0].instruction)
 const after=buildOsLearningPack(configs,{}, {revision:3,rules:[]});assert.notEqual(pinned.fingerprint,after.fingerprint);assert.equal(pinned.decisionPrinciples.rules.length,1)
 assert.throws(()=>buildOsLearningPack(configs,{}, {revision:4,rules:[{instruction:'x'.repeat(25000)}]}),e=>e.status===409)
})
