import {matchesSecret} from './integrationStore.js'

// Public YouTube candidate lookup only. This credential cannot authorize AI,
// learning/admin detail, sending, tracking refresh or campaign mutations.
export function isOsDiscoveryRead(request,env=process.env){
 const token=String(request.headers.authorization||'').match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
 return request.method==='POST'&&request.originalUrl.split('?')[0]==='/discovery/youtube/search'&&matchesSecret(token,env.CREATOROPS_DISCOVERY_READ_TOKEN)
}
