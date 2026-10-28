import test from 'node:test'
import assert from 'node:assert/strict'
import {isOsDiscoveryRead} from '../server/osDiscoveryAccess.js'
test('dedicated OS discovery credential authorizes only POST YouTube lookup and never AI, admin, learning or sending',()=>{
 const token='isolated-discovery-key-'.repeat(2),env={CREATOROPS_DISCOVERY_READ_TOKEN:token},request={method:'POST',originalUrl:'/discovery/youtube/search',headers:{authorization:'Bearer '+token}}
 assert.equal(isOsDiscoveryRead(request,env),true)
 for(const originalUrl of ['/ai/content-guide','/admin/llm-ops','/os-bridge/v1/learning','/tracking/refresh','/outreach/send'])assert.equal(isOsDiscoveryRead({...request,originalUrl},env),false)
 assert.equal(isOsDiscoveryRead({...request,method:'GET'},env),false)
 assert.equal(isOsDiscoveryRead(request,{}),false)
 assert.equal(isOsDiscoveryRead({...request,headers:{authorization:'Bearer wrong'}},env),false)
})
