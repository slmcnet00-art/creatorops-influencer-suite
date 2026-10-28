import {createHash,createHmac} from 'node:crypto'
import {matchesSecret} from './integrationStore.js'

const root='/os-bridge/v1/observations', machine=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/.test(x)
const count=x=>Number.isSafeInteger(x)&&x>=0?x:null
const fail=status=>{throw Object.assign(Error('Observation scope or source unavailable.'),{status})}
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex')
const stamp=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))?new Date(x).toISOString():null
const uuid=x=>{const h=digest(x);return h.slice(0,8)+'-'+h.slice(8,12)+'-5'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32)}

// Only SELECT queries are available here. No discovery, retry, provider, vault
// detail or mutation path is reused. An OS-run filter with no native calls is
// an empty page, not a synthetic native generation.
export function registerOsObservations(app,{getClient,workspaceId,observePrinciples,env=process.env}){
 const authenticate=(req,res,next)=>{
  res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'})
  if(!matchesSecret(String(req.headers.authorization||''),'Bearer '+(env.CREATOROPS_OBSERVATION_READ_TOKEN||''))||String(env.CREATOROPS_OBSERVATION_READ_TOKEN||'').length<32)return res.status(401).json({error:'Observation read authentication required.'})
  const {project_id,os_run_id}=req.query,projects=String(env.CREATOROPS_OBSERVATION_PROJECT_IDS||'').split(',').map(x=>x.trim())
  if(!machine(project_id)||!machine(os_run_id)||!projects.includes(project_id))return res.status(403).json({error:'Observation project scope denied.'})
  next()
 }
 const wrap=fn=>async(req,res)=>{try{const value=await fn(req);if(Buffer.byteLength(JSON.stringify(value))>1048576)fail(503);res.json(value)}catch(e){res.status([400,403].includes(e.status)?e.status:503).json({error:'Native metadata unavailable; no execution resumed.'})}}
 app.get(root+'/runs',authenticate,wrap(async req=>{
  const {project_id,os_run_id,cursor}=req.query,limit=req.query.limit===undefined?50:Number(req.query.limit),token=env.CREATOROPS_OBSERVATION_READ_TOKEN
  if(!Number.isInteger(limit)||limit<1||limit>50)fail(400)
  let after=null
  if(cursor){try{
   if(typeof cursor!=='string'||cursor.length>300)fail(400)
   const [raw,signature]=cursor.split('.');if(!matchesSecret(signature,createHmac('sha256',token).update(raw).digest('hex')))fail(400)
   const mark=JSON.parse(Buffer.from(raw,'base64url'));if(mark.p!==project_id||mark.r!==os_run_id||!/^\d+$/.test(mark.i))fail(400);after=mark.i
  }catch{fail(400)}}
  let query=getClient().from('ai_generation_runs').select('id,model,status,created_at,osRunId:input_payload->>osRunId,osProjectId:input_payload->>osProjectId,finishedAt:output_payload->>finishedAt,usage:output_payload->usage,estimatedCostUsd:output_payload->estimatedCostUsd,providerReceiptId:output_payload->>providerReceiptId,decisionMemory:input_payload->decisionMemory')
   .eq('workspace_id',workspaceId).eq('run_type','llm-call').eq('input_payload->>osProjectId',project_id).eq('input_payload->>osRunId',os_run_id).order('id',{ascending:true}).limit(limit+1)
  if(after)query=query.gt('id',after)
  const {data,error}=await query;if(error)fail(503)
  const rows=data||[],events=rows.slice(0,limit).map(row=>{
   const at=stamp(row.finishedAt)||stamp(row.created_at);if(!at)fail(503)
   const status={success:'completed',failed:'failed',partial:'running'}[row.status]||'unknown'
   const event={schemaVersion:1,sourceSystem:'creatorops',workspaceId:'growth-os',projectId:project_id,osRunId:os_run_id,traceId:os_run_id,nativeRunId:String(row.id),revision:Date.parse(at)*16+(status==='completed'?8:status==='failed'?9:3),occurredAt:at,status,submission:'accepted',quality:'not_evaluated',artifactRefs:[],
    calls:[{nativeCallId:String(row.id),provider:'openai',providerReceiptId:machine(row.providerReceiptId)?row.providerReceiptId:null,model:machine(row.model)?row.model:null,stage:'generation',status,inputTokens:count(row.usage?.inputTokens),outputTokens:count(row.usage?.outputTokens),cost:typeof row.estimatedCostUsd==='number'&&row.estimatedCostUsd>=0?{amount:row.estimatedCostUsd,currency:'USD'}:null,startedAt:stamp(row.created_at),completedAt:stamp(row.finishedAt)}],
    principleRefs:(row.decisionMemory?.rules||[]).filter(r=>machine(r.caseId)&&Number.isInteger(r.version)&&r.version>0).map(r=>({id:r.caseId,version:r.version,state:status==='completed'?'applied':'unknown'}))}
   return {...event,eventId:uuid(event)}
  })
  let nextCursor=null
  if(rows.length>limit){const raw=Buffer.from(JSON.stringify({p:project_id,r:os_run_id,i:String(rows[limit-1].id)})).toString('base64url');nextCursor=raw+'.'+createHmac('sha256',token).update(raw).digest('hex')}
  return {schemaVersion:1,events,hasMore:Boolean(nextCursor),nextCursor}
 }))
 app.get(root+'/principles',authenticate,wrap(async req=>{
  const observed=await observePrinciples()
  if(observed.states.length>100)fail(503)
  return {schemaVersion:1,sourceSystem:'creatorops',projectId:req.query.project_id,osRunId:req.query.os_run_id,states:observed.states}
 }))
}
