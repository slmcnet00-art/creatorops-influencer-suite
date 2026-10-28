import {createHash, timingSafeEqual} from 'node:crypto'

export const LEARNING_CONTRACT = 'miping.creatorops-learning.v1'
export const MAX_LEARNING_BYTES = 24000
const hash = text => createHash('sha256').update(text).digest('hex')
export const learningFeatures = stage => stage === 'strategy'
  ? ['creator-recommendation', 'content-guide', 'campaign-strategy']
  : ['creator-recommendation', 'content-guide']
const problem = (status, message) => Object.assign(new Error(message), {status})
const chunks = text => {
  const paragraphs = String(text).replace(/\r\n/g, '\n').split(/\n\s*\n/).filter(s => s.trim())
  return paragraphs.flatMap(p => Array.from({length: Math.ceil(p.length / 800)}, (_, i) => p.slice(i * 800, (i + 1) * 800)))
}

// Read-only company policy context. No model calls, edits, contacts or sending.
// Only active policies of the fixed company workspace may enter this pack.
export function buildOsLearningPack(configs, {stage = 'discovery', query = ''} = {}, decisionPrinciples = null) {
  if (!['discovery', 'guide', 'review', 'strategy'].includes(stage)) throw problem(400, 'Unsupported learning stage.')
  if (typeof query !== 'string' || query.length > 100) throw problem(400, 'A bounded public topic query is required.')
  const terms = [...new Set(query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(s => s.length >= 2))]
  const required = learningFeatures(stage), selected = required.map(feature => configs.find(c => c.featureKey === feature && c.status === 'active'))
  if (selected.some(c => !c)) throw problem(409, 'Active recommendation/content-guide policy is required for this stage.')
  const candidates = [], policies = selected.map(c => {
    if (typeof c.version !== 'string' || !c.version || c.version.length > 100) throw problem(409, 'Policy version is required.')
    const systemPrompt = String(c.systemPrompt || ''), rules = String(c.rules || '')
    const material = (c.attachments || []).map((a, index) => {
      const text = String(a.text || ''), id = String(a.id || index).slice(0, 180), sha256 = hash(text)
      chunks(text).forEach((text, part) => candidates.push({featureKey:c.featureKey, id, sha256, part, text,
        score:terms.reduce((n, term) => n + (text.toLowerCase().includes(term) ? 1 : 0), 0)}))
      return {id, sha256, textBytes:Buffer.byteLength(text), indexed:Boolean(text.trim()), selectedParts:[]}
    })
    if (!systemPrompt.trim() && !rules.trim() && !material.some(a => a.indexed)) throw problem(409, 'Active policy has no usable instructions or extracted knowledge.')
    return {featureKey:c.featureKey, version:c.version, updatedAt:c.updatedAt || null,
      policySha256:hash(JSON.stringify({systemPrompt, rules, materials:material.map(({id,sha256}) => ({id,sha256}))})), systemPrompt, rules, materials:material}
  })
  if(policies.some(p=>p.materials.length>20||new Set(p.materials.map(m=>m.id)).size!==p.materials.length))throw problem(409,'Learning material identities require review.')
  const pack = {contract:LEARNING_CONTRACT, stage, scope:'company-active-policies-only', requiredFeatures:required,
    retrieval:{method:'public-query-paragraph-match-v1', maxBytes:MAX_LEARNING_BYTES, excerpts:[], totalIndexedMaterials:policies.reduce((n,p) => n+p.materials.filter(a=>a.indexed).length,0), selectedMaterials:0,
      completeLibraryRead:false, note:'Approved policy instructions are complete; attached text uses bounded relevant excerpts. Unselected/missing original files are not claimed as applied.'}, policies,
    ...(decisionPrinciples ? {decisionPrinciples} : {})}
  if (Buffer.byteLength(JSON.stringify(pack)) > MAX_LEARNING_BYTES - 100) throw problem(409, 'Mandatory policy instructions exceed the bounded context. Review policy size before execution.')
  candidates.sort((a,b) => b.score-a.score || a.featureKey.localeCompare(b.featureKey) || a.id.localeCompare(b.id) || a.part-b.part)
  for (const c of candidates) {
    const material = policies.find(p=>p.featureKey===c.featureKey).materials.find(a=>a.id===c.id)
    if (material.selectedParts.length >= 2) continue
    pack.retrieval.excerpts.push(c); material.selectedParts.push(c.part)
    if (Buffer.byteLength(JSON.stringify(pack)) > MAX_LEARNING_BYTES - 100) {pack.retrieval.excerpts.pop();material.selectedParts.pop();continue}
    if (pack.retrieval.excerpts.length >= 12) break
  }
  pack.retrieval.selectedMaterials=policies.reduce((n,p)=>n+p.materials.filter(a=>a.selectedParts.length).length,0)
  return {...pack,fingerprint:hash(JSON.stringify(pack))}
}

export function registerOsLearningBridge(app, {loadActiveConfigs, loadDecisionPrinciples = async () => null, env = process.env}) {
  app.post('/os-bridge/v1/learning', async (request, response) => {
    response.set('Cache-Control','no-store')
    const expected=String(env.CREATOROPS_OS_TOKEN || ''), supplied=String(request.headers.authorization || '')
    const a=Buffer.from('Bearer '+expected), b=Buffer.from(supplied)
    if (expected.length<32 || a.length!==b.length || !timingSafeEqual(a,b)) return response.status(401).json({error:'OS learning service authentication required.'})
    try {
      const body=request.body
      if (!body || Object.keys(body).some(k=>!['stage','query'].includes(k))) throw problem(400,'Unsupported learning request.')
      const pack=buildOsLearningPack(await loadActiveConfigs(),body,await loadDecisionPrinciples(body.stage || 'discovery'))
      response.json(pack)
    } catch(error) {
      response.status([400,409].includes(error.status) ? error.status : 503).json({error:error.status===409?error.message:'Learning source is unavailable; no model request was made.'})
    }
  })
}
