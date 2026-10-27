import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { apiError, matchesSecret } from './integrationStore.js'
import { compareAndSwapSnapshot } from '../src/snapshotConcurrency.js'
import { aggregateEngagement, getActualRevenue, getActualSpend } from '../src/performanceMetrics.js'
import { campaignTypeOptions, contentFormatOptions } from '../src/campaignTypes.js'
import { MARKET_OPTIONS, buildCampaignMarkets } from '../src/marketLocalization.js'

const prefix = '/os-bridge/v1'
const textFields = new Set(['name', 'product', 'objective', 'targetPersona', 'searchKeywords', 'exclusionKeywords', 'mission', 'reward', 'approvalFlow', 'kpiGoal', 'landingUrl', 'oneMessage', 'hookPoints', 'preferredPlatforms', 'deadline'])
const numberFields = new Set(['budget', 'targetViews', 'targetConversions', 'targetOrders', 'targetRevenue', 'minFollowers', 'maxCreatorFee', 'recommendationTargetCount', 'sellerRecruitTarget'])
export function validateCampaignPatch(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw apiError(400, 'campaign must be an object.')
  const out = {}
  for (const [key, value] of Object.entries(input)) {
    if (textFields.has(key)) {
      if (typeof value !== 'string' || value.length > 5000) throw apiError(400, `Invalid ${key}.`)
      out[key] = value.trim()
      if (key === 'name' && !out[key]) throw apiError(400, 'name is required.')
      if (key === 'landingUrl' && value && !/^https?:\/\//i.test(value)) throw apiError(400, 'landingUrl must be http or https.')
    } else if (numberFields.has(key)) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e15) throw apiError(400, `Invalid ${key}.`)
      out[key] = value
    } else if (key === 'campaignType') {
      if (!campaignTypeOptions.includes(value)) throw apiError(400, 'Unsupported campaign type.')
      out[key] = value
    } else if (key === 'contentFormats') {
      if (!Array.isArray(value) || value.some(v => !contentFormatOptions.includes(v))) throw apiError(400, 'Unsupported content format.')
      out[key] = [...new Set(value)]
    } else if (key === 'targetCountry') {
      if (!MARKET_OPTIONS.some(m => m.country === value)) throw apiError(400, 'Unsupported target country.')
      out[key] = value
    } else if (key === 'targetMarkets') {
      if (!Array.isArray(value) || !value.length || value.some(v => !MARKET_OPTIONS.some(m => m.country === v))) throw apiError(400, 'Unsupported target markets.')
      out[key] = [...new Set(value)]
    } else if (key === 'outputLanguage') {
      if (!['ko', 'en', 'ja', 'zh', 'zh-CN'].includes(value)) throw apiError(400, 'Unsupported output language.')
      out[key] = value
    } else if (key === 'status') {
      if (!['섭외', '콘텐츠 제작', '라이브', '리포트', '완료'].includes(value)) throw apiError(400, 'Unsupported campaign status.')
      out[key] = value
    } else if (key === 'schedule') {
      if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !['recruitStart', 'recruitEnd', 'uploadDue', 'reportDue'].includes(k)) || Object.values(value).some(v => typeof v !== 'string' || (v !== '' && (!/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v)))))) throw apiError(400, 'Invalid campaign schedule.')
      out[key] = { ...value }
    } else throw apiError(400, `Unsupported or read-only field: ${key}`)
  }
  return out
}
export function campaignReport(campaign, workspace) {
  const matches = r => String(r.campaignId ?? r.campaign_id) === String(campaign.id)
    && (r.brandId == null || String(r.brandId) === String(campaign.brandId))
  const posts = (workspace.trackedPosts || []).filter(matches)
  const spend = getActualSpend(campaign, workspace.fulfillmentRecords, workspace.creatorOperations)
  const revenue = getActualRevenue(campaign, workspace.conversionEvents)
  return { campaignId: campaign.id, brandId: campaign.brandId, name: campaign.name, status: campaign.status,
    contentCount: posts.length, recruitedCount: (workspace.recruitedPool || []).filter(matches).length,
    views: posts.reduce((n, p) => n + Number(p.views || 0), 0), engagementRate: aggregateEngagement(posts),
    conversions: posts.reduce((n, p) => n + Number(p.conversions || 0), 0), actualSpendKrw: spend, actualRevenueKrw: revenue,
    roas: spend > 0 ? revenue / spend : null, actualMoneyAvailable: { spend: spend > 0, revenue: revenue > 0 },
    measurement: 'latest-snapshot-not-historical; no modeled revenue',
  }
}
function exposedCampaign(row) {
  const keys = ['id', 'brandId', 'status', 'createdAt', 'updatedAt', 'campaignType', 'contentFormats', 'targetCountry', 'outputLanguage', 'markets', 'targetMarkets', 'marketMode', 'schedule', ...textFields, ...numberFields]
  return Object.fromEntries(keys.filter(k => Object.hasOwn(row, k)).map(k => [k, row[k]]))
}
export function createCompanyOs({ getClient, workspaceId, env = process.env, requireAdmin, publish = async () => {}, audit = async () => {} }) {
  const access = (req, res, next) => {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (matchesSecret(token, env.CREATOROPS_OS_API_TOKEN)) { req.osActor = { id: null, machine: true }; return next() }
    requireAdmin(req, res, error => { if (error) return next(error); req.osActor = req.adminUser; next() })
  }
  async function snapshots() {
    const client = getClient()
    if (!client) throw apiError(503, 'The shared database is unavailable.')
    const [full, scoped] = await Promise.all([
      client.from('workspace_snapshots').select('payload,updated_at').eq('workspace_id', workspaceId).maybeSingle(),
      client.from('brand_scoped_snapshots').select('brand_id,payload,updated_at').eq('workspace_id', workspaceId),
    ])
    if (full.error) throw full.error
    if (scoped.error) throw scoped.error
    const base = full.data?.payload || {}, scopes = scoped.data || []
    const brands = new Map((base.brands || []).map(b => [String(b.id), b]))
    const scopeMap = new Map(scopes.map(s => [String(s.brand_id), s]))
    for (const row of scopes) if (row.payload?.brand) brands.set(String(row.brand_id), row.payload.brand)
    return { base, brands, scopeMap, fullVersion: full.data?.updated_at || null }
  }
  const wrap = fn => async (req, res, next) => { try { res.set('Cache-Control', 'no-store'); await fn(req, res) } catch (e) { next(e) } }
  const getBrand = (data, brandId) => {
    if (!data.brands.has(String(brandId))) throw apiError(404, 'Brand not found.')
    const scope = data.scopeMap.get(String(brandId))
    return { payload: scope?.payload || data.base, version: scope?.updated_at || data.fullVersion, scope }
  }
  const allCampaigns = data => [...(data.base.campaigns || []).filter(c => !data.scopeMap.has(String(c.brandId))),
    ...[...data.scopeMap.values()].flatMap(s => (s.payload?.campaigns || []).map(c => ({ ...c, brandId: s.brand_id }))) ]
  const findCampaign = (data, id, brandId) => {
    const rows = allCampaigns(data).filter(c => String(c.id) === String(id) && (!brandId || String(c.brandId) === String(brandId)))
    if (!rows.length) throw apiError(404, 'Campaign not found.')
    if (rows.length > 1) throw apiError(409, 'Specify brandId to disambiguate the campaign.')
    return rows[0]
  }
  const emit = async (type, data) => {
    try { return await publish(type, data) } catch { return { queued: false, reason: 'event-storage-unavailable' } }
  }
  function register(app) {
    app.get(`${prefix}/openapi.json`, access, wrap(async (_req, res) => res.json(JSON.parse(readFileSync(new URL('../docs/company-os-openapi.json', import.meta.url), 'utf8')))))
    app.get(`${prefix}/capabilities`, access, wrap(async (_req, res) => res.json({ data: { version: 'creatorops.os.v1', workspaceId,
      capabilities: ['campaign.read', 'campaign.create', 'campaign.update', 'report.read', 'webhook.manage', 'discovery.search', 'ai.generate', 'tracking.refresh'],
      mutations: { ifMatchRequired: true, createIdempotencyKeyRequired: true, deletionSupported: false },
      openapiPath: `${prefix}/openapi.json`, note: 'OS API credential is separate from the read-only learning token. Existing scoped brands only.' } })))
    app.get(`${prefix}/brands`, access, wrap(async (_req, res) => {
      const data = await snapshots()
      res.json({ data: { brands: [...data.brands.values()].map(b => ({ id: b.id, name: b.name, version: getBrand(data, b.id).version, writable: data.scopeMap.has(String(b.id)) })) } })
    }))
    app.get(`${prefix}/campaigns`, access, wrap(async (req, res) => {
      const data = await snapshots(), rows = allCampaigns(data).filter(c => !req.query.brandId || String(c.brandId) === String(req.query.brandId))
      const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50)), offset = Math.max(0, Number(req.query.offset) || 0)
      res.json({ data: { campaigns: rows.slice(offset, offset + limit).map(exposedCampaign), total: rows.length, limit, offset } })
    }))
    app.get(`${prefix}/campaigns/:id`, access, wrap(async (req, res) => {
      const data = await snapshots(), campaign = findCampaign(data, req.params.id, req.query.brandId)
      const version = getBrand(data, campaign.brandId).version
      res.set('ETag', `"${version}"`).json({ data: { campaign: exposedCampaign(campaign), version } })
    }))
    async function mutate(req, res, create) {
      const body = req.body || {}, brandId = String(body.brandId || '')
      if (!brandId || Object.keys(body).some(k => !['brandId', 'campaign'].includes(k))) throw apiError(400, 'Provide brandId and campaign only.')
      const patch = validateCampaignPatch(body.campaign), data = await snapshots(), brand = getBrand(data, brandId)
      if (!brand.scope) throw apiError(409, 'Initialize the brand workspace in CreatorOps before OS writes.')
      const version = String(req.headers['if-match'] || '').replace(/^"|"$/g, '')
      const key = String(req.headers['idempotency-key'] || '')
      if (create && (!key || key.length > 160)) throw apiError(400, 'An Idempotency-Key of up to 160 characters is required.')
      const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
      // Existing UI selectors use numeric campaign IDs. Reserve a safe-integer range
      // above timestamp IDs while keeping deterministic IDs for idempotent creation.
      const inputHash = digest(patch), id = create ? 2 ** 52 + Number.parseInt(digest([workspaceId, brandId, key]).slice(0, 12), 16) : req.params.id
      const existing = (brand.payload.campaigns || []).find(c => String(c.id) === String(id))
      if (create && existing) {
        if (existing.osInputHash !== inputHash) throw apiError(409, 'Idempotency key was already used with different input.')
        return res.json({ data: { campaign: exposedCampaign(existing), version: brand.version, duplicate: true } })
      }
      if (!create && !existing) throw apiError(404, 'Campaign not found.')
      if (!version) throw apiError(428, 'If-Match is required; read the brand or campaign version first.')
      if (version !== brand.version) throw apiError(409, 'The brand workspace changed. Refresh before writing.')
      if (create && !patch.name) throw apiError(400, 'name is required.')
      const campaign = create ? { id, brandId: brand.payload.brandId ?? brand.payload.brand?.id ?? brandId, status: '섭외', creatorIds: [], progress: 0, budget: 0,
        owner: data.brands.get(brandId)?.owner || data.brands.get(brandId)?.name || '', deadline: '일정 미정',
        spend: 0, revenue: 0, performanceSource: 'unreported', campaignType: '제안형', contentFormats: [],
        createdAt: new Date().toISOString(), ...patch, osInputHash: inputHash,
      } : { ...existing, ...patch }
      if (patch.targetMarkets || patch.targetCountry || create) {
        const countries = patch.targetMarkets || [patch.targetCountry || 'KR']
        if (patch.targetMarkets && patch.targetCountry && countries[0] !== patch.targetCountry) throw apiError(400, 'targetCountry must match the first target market.')
        campaign.markets = buildCampaignMarkets(countries, existing || {})
        campaign.targetMarkets = countries
        campaign.targetCountry = countries[0]
        campaign.marketMode = countries.length > 1 ? 'multi' : 'single'
        campaign.outputLanguage = patch.outputLanguage || campaign.markets[0].language
        campaign.localCurrency = campaign.markets[0].currency
        campaign.exchangeRateKrw = campaign.markets[0].exchangeRateKrw
      }
      campaign.updatedAt = new Date().toISOString()
      if (patch.schedule) campaign.schedule = { ...existing?.schedule, ...patch.schedule }
      if (patch.schedule && Object.hasOwn(patch.schedule, 'recruitEnd') && !Object.hasOwn(patch, 'deadline')) campaign.deadline = patch.schedule.recruitEnd || '일정 미정'
      const next = { ...brand.payload, campaigns: create ? [...(brand.payload.campaigns || []), campaign]
        : brand.payload.campaigns.map(c => String(c.id) === String(id) ? campaign : c) }
      const saved = await compareAndSwapSnapshot(getClient(), 'brand_scoped_snapshots', { workspace_id: workspaceId, brand_id: brandId }, next, version)
      if (saved.status !== 'saved') throw apiError(409, 'Concurrent changes were preserved. Refresh and retry.')
      await audit({ actorId: req.osActor?.id, action: create ? 'os.campaign.created' : 'os.campaign.updated', targetType: 'campaign', targetId: id, metadata: { brandId } })
      const webhook = await emit(create ? 'campaign.created' : 'campaign.updated', { campaignId: id, brandId, version: saved.updatedAt })
      res.status(create ? 201 : 200).set('ETag', `"${saved.updatedAt}"`).json({ data: { campaign: exposedCampaign(campaign), version: saved.updatedAt, webhook } })
    }
    app.post(`${prefix}/campaigns`, access, wrap((req, res) => mutate(req, res, true)))
    app.patch(`${prefix}/campaigns/:id`, access, wrap((req, res) => mutate(req, res, false)))
    app.get(`${prefix}/reports`, access, wrap(async (req, res) => {
      const data = await snapshots(), campaigns = allCampaigns(data).filter(c => !req.query.brandId || String(c.brandId) === String(req.query.brandId))
      const reports = campaigns.map(c => campaignReport(c, getBrand(data, c.brandId).payload))
      res.json({ data: { asOf: new Date().toISOString(), currency: 'KRW', campaigns: reports,
        totals: { campaigns: reports.length, views: reports.reduce((n, r) => n + r.views, 0), actualSpendKrw: reports.reduce((n, r) => n + r.actualSpendKrw, 0), actualRevenueKrw: reports.reduce((n, r) => n + r.actualRevenueKrw, 0) },
        note: 'Latest campaign aggregates only. No bulk export of YouTube discovery data.' } })
    }))
    app.get(`${prefix}/reports/:id`, access, wrap(async (req, res) => {
      const data = await snapshots(), campaign = findCampaign(data, req.params.id, req.query.brandId), brand = getBrand(data, campaign.brandId)
      res.json({ data: { ...campaignReport(campaign, brand.payload), version: brand.version, asOf: new Date().toISOString() } })
    }))
  }
  return { register, access }
}
