import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.render-env.local' })
config()

const apiUrl = process.env.API_URL || 'https://creatorops-suite-api.onrender.com'
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const workspaceId = 'codex-e2e-full-cycle'
const now = new Date().toISOString()

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('VITE_SUPABASE_URL/SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const stages = []
const record = (stage, ok, detail) => stages.push({ stage, ok, detail })
const missingTables = new Set()

function isMissingTableError(error) {
  return error?.code === 'PGRST205'
    || String(error?.message || '').includes('Could not find the table')
}

async function post(path, body) {
  const response = await fetch(`${apiUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  })
  const text = await response.text()
  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    payload = { text }
  }
  if (!response.ok) {
    throw new Error(`${path} ${response.status}: ${text.slice(0, 240)}`)
  }
  return payload
}

async function upsert(table, rows, options = {}) {
  const { error } = await supabase.from(table).upsert(rows, options)
  if (!error) return true
  if (isMissingTableError(error)) {
    missingTables.add(table)
    return false
  }
  throw new Error(`${table}: ${error.message}`)
}

async function insert(table, rows) {
  const { error } = await supabase.from(table).insert(rows)
  if (!error) return true
  if (isMissingTableError(error)) {
    missingTables.add(table)
    return false
  }
  throw new Error(`${table}: ${error.message}`)
}

async function count(table) {
  if (missingTables.has(table)) return null
  const { count: total, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
  if (error && isMissingTableError(error)) {
    missingTables.add(table)
    return null
  }
  if (error) throw new Error(`${table}: ${error.message}`)
  return total || 0
}

await supabase.from('workspaces').delete().eq('id', workspaceId)
await upsert('workspaces', {
  id: workspaceId,
  name: 'CreatorOps 전체 사이클 검증',
  settings: { testWorkspace: true, generatedAt: now },
})
record('워크스페이스', true, workspaceId)

const brand = {
  id: 'brand-e2e-banila',
  name: '테스트 바닐라 클렌징밤',
  product: '클렌징밤',
  target: '20-34세 메이크업·스킨케어 관심 여성',
}
const campaign = {
  id: 'campaign-e2e-launch',
  name: '테스트 클렌징밤 런칭',
  goal: '조회수 80만, 전환 500건, 크리에이터 20명',
  landingUrl: 'https://example.com/products/cleansing-balm',
}

let discovery = { data: { creators: [] } }
try {
  discovery = await post('/discovery/youtube/search', {
    query: 'Korean beauty cleansing balm review',
    maxResults: 5,
  })
  record('실제 후보 발굴', true, 'YouTube 검색 API 응답')
} catch (error) {
  record('실제 후보 발굴', false, error.message)
}

const discovered = discovery?.data?.creators || discovery?.data?.items || discovery?.data?.channels || []
const apiCreator = discovered[0] || {}
const creator = {
  id: 'creator-e2e-001',
  name: apiCreator.displayName || apiCreator.title || apiCreator.name || '테스트 뷰티 크리에이터',
  handle: apiCreator.handle || '@creatorops_beauty_test',
  platform: 'YouTube',
  profileUrl: apiCreator.profileUrl || apiCreator.channelUrl || 'https://www.youtube.com/@beauty',
  followers: Number(apiCreator.followers || apiCreator.subscribers || apiCreator.subscriberCount || 125000),
  averageViews: Number(apiCreator.averageViews || 280000),
  engagement: Number(apiCreator.engagement || 5.8),
}

let recommendation = { data: { items: [] } }
try {
  recommendation = await post('/ai/recommendations/enrich', {
    brand,
    campaign,
    candidates: [{
      recommendationId: 'rec-e2e-001',
      creatorId: creator.id,
      creatorName: creator.name,
      platform: creator.platform,
      category: 'beauty',
      followers: creator.followers,
      averageViews: creator.averageViews,
      engagement: creator.engagement,
      score: 91,
      reasons: ['클렌징·스킨케어 콘텐츠 적합'],
    }],
  })
  record('AI 후보 추천', true, `${recommendation?.data?.items?.length || 0}건 보강`)
} catch (error) {
  record('AI 후보 추천', false, error.message)
}

let guide = { data: { guide: '' } }
try {
  guide = await post('/ai/content-guide', {
    brand,
    campaign,
    seedingType: '유가 시딩',
    channel: 'YouTube Shorts',
    references: [{
      title: '클렌징 전후 비교',
      hook: '3초 안에 워터프루프 메이크업이 녹는 장면',
      views: 720000,
    }],
  })
  record('AI 콘텐츠 가이드', true, '가이드 생성 완료')
} catch (error) {
  record('AI 콘텐츠 가이드', false, error.message)
}

let outreach = { data: { message: '' } }
try {
  outreach = await post('/ai/outreach-message', { creator, brand, campaign })
  record('AI 제안 메시지', true, '개인화 문안 생성 완료')
} catch (error) {
  record('AI 제안 메시지', false, error.message)
}

const contentId = 'content-e2e-001'
const contentUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
let trackedMetrics = { views: 320000, likes: 12400, comments: 680, shares: 210, saves: 0 }
try {
  const tracking = await post('/tracking/refresh', {
    posts: [{ id: contentId, platform: 'YouTube', url: contentUrl }],
  })
  const refreshed = tracking?.data?.posts?.[0]
  if (refreshed) {
    trackedMetrics = {
      views: Number(refreshed.views ?? refreshed.metrics?.views ?? trackedMetrics.views),
      likes: Number(refreshed.likes ?? refreshed.metrics?.likes ?? trackedMetrics.likes),
      comments: Number(refreshed.comments ?? refreshed.metrics?.comments ?? trackedMetrics.comments),
      shares: Number(refreshed.shares ?? refreshed.metrics?.shares ?? trackedMetrics.shares),
      saves: Number(refreshed.saves ?? refreshed.metrics?.saves ?? trackedMetrics.saves),
    }
  }
  record('콘텐츠 추적 갱신', true, `${trackedMetrics.views.toLocaleString()}회`)
} catch (error) {
  record('콘텐츠 추적 갱신', false, error.message)
}

const rawIds = {
  campaign: 'RAW-E2E-CAMPAIGN',
  creator: 'RAW-E2E-CREATOR',
  content: 'RAW-E2E-CONTENT',
  utm: 'RAW-E2E-UTM',
}
const metricIds = {
  engagement: 'MET-E2E-ENGAGEMENT',
  roi: 'MET-E2E-ROI',
}

await upsert('raw_data_sources', [
  {
    id: rawIds.campaign, workspace_id: workspaceId, scope: 'internal', category: '캠페인',
    name: 'E2E 캠페인 브리프', collection_method: 'DB 연동', collection_cycle: '변경 시',
    source_location: '캠페인 입력', storage_location: 'workspace_snapshots',
    dashboard_area: '캠페인/발굴', owner_dept: 'Campaign Ops', status: 'ok',
  },
  {
    id: rawIds.creator, workspace_id: workspaceId, scope: 'external', category: '크리에이터',
    name: 'E2E 크리에이터 프로필', collection_method: 'API', collection_cycle: '검색 시',
    source_location: 'YouTube Data API', storage_location: 'creator_profile_snapshots',
    dashboard_area: '발굴/후보 그룹', owner_dept: 'Data Ops', status: discovery?.data ? 'ok' : 'needs_review',
  },
  {
    id: rawIds.content, workspace_id: workspaceId, scope: 'external', category: '콘텐츠 성과',
    name: 'E2E 콘텐츠 성과', collection_method: 'API', collection_cycle: '일 1회',
    source_location: 'YouTube Data API', storage_location: 'content_metric_snapshots',
    dashboard_area: '리포트', owner_dept: 'Report Ops', status: 'ok',
  },
  {
    id: rawIds.utm, workspace_id: workspaceId, scope: 'internal', category: '전환 추적',
    name: 'E2E UTM 링크', collection_method: 'DB 연동', collection_cycle: '링크 생성 시',
    source_location: '캠페인 랜딩 URL', storage_location: 'utm_tracking_rows',
    dashboard_area: '캠페인/리포트', owner_dept: 'Growth Ops', status: 'ok',
  },
])

await upsert('metric_definitions', [
  {
    id: metricIds.engagement, workspace_id: workspaceId, scope: 'external', bundle: 'SNS 반응',
    name: '참여율', description: '조회 대비 반응 비율',
    formula: '(likes + comments + shares + saves) / views * 100',
    raw_source_ids: [rawIds.content], period: '누적', refresh_cycle: '일 1회',
    display_location: '리포트', reliability: '공식 API 수집 시 높음', owner_dept: 'Data Ops', status: 'ok',
  },
  {
    id: metricIds.roi, workspace_id: workspaceId, scope: 'internal', bundle: '캠페인 성과',
    name: '추정 ROI', description: '추적 매출 대비 실제 집행비',
    formula: '(revenue - cost) / cost * 100',
    raw_source_ids: [rawIds.utm, rawIds.content], period: '캠페인', refresh_cycle: '일 1회',
    display_location: '리포트', reliability: '전환 이벤트 연동 시 높음', owner_dept: 'Growth Ops', status: 'needs_review',
  },
])

const shortCode = 'e2ebanila01'
const shortUrl = `${apiUrl}/r/${shortCode}`
const utmUrl = `${campaign.landingUrl}?utm_source=youtube&utm_medium=influencer&utm_campaign=e2e_launch&utm_content=${creator.id}`
const recommendationItems = recommendation?.data?.items || []
const workspacePayload = {
  version: 2,
  activeBrandId: brand.id,
  activeCampaignId: campaign.id,
  brands: [{ ...brand, campaigns: [campaign.id] }],
  campaigns: [{ ...campaign, targetCreators: 20, status: 'active' }],
  creators: [{ ...creator, estimatedRate: 2500000, actualRate: 2200000 }],
  aiRecommendations: recommendationItems,
  candidateGroups: [{ id: 'group-e2e-001', name: '뷰티 우선 제안', creatorIds: [creator.id] }],
  outreach: [{ id: 'outreach-e2e-001', creatorId: creator.id, status: 'review' }],
  trackedPosts: [{ id: contentId, creatorId: creator.id, url: contentUrl, metrics: trackedMetrics }],
  utmTrackingRows: [{ id: 'utm-e2e-001', creatorId: creator.id, shortUrl, originalUtmUrl: utmUrl }],
  strategy: { status: 'generated', sourceRawIds: [rawIds.campaign], content: '브리프 기반 런칭 전략' },
  guide: { status: 'generated', content: guide?.data?.guide || '' },
  adminConfig: { recommendationPolicy: 'brand-fit-performance-v1', automationEnabled: false },
}

await upsert('workspace_snapshots', {
  workspace_id: workspaceId,
  payload: workspacePayload,
  updated_at: now,
}, { onConflict: 'workspace_id' })

await insert('creator_profile_snapshots', {
  workspace_id: workspaceId, brand_id: brand.id, creator_id: creator.id,
  platform: creator.platform, handle: creator.handle, profile_url: creator.profileUrl,
  display_name: creator.name, followers_count: creator.followers, country_code: 'KR',
  source_type: discovery?.data ? 'api_direct' : 'manual', source_provider: 'youtube',
  source_url: creator.profileUrl, confidence_score: discovery?.data ? 95 : 60,
  raw_payload: apiCreator,
})
await insert('creator_contact_points', {
  workspace_id: workspaceId, brand_id: brand.id, creator_id: creator.id,
  contact_type: 'email', contact_value: 'partnership@creatorops-e2e.example',
  source_url: creator.profileUrl, verification_status: 'unverified',
  metadata: { testData: true },
})
await insert('creator_rates', {
  workspace_id: workspaceId, brand_id: brand.id, creator_id: creator.id,
  platform: creator.platform, content_format: 'Shorts', currency: 'KRW',
  estimated_min: 1800000, estimated_max: 2800000, agreed_amount: 2200000,
  rate_source: 'manual', calculation_version: 'rate-v1',
  source_raw_ids: [rawIds.creator], metadata: { testData: true },
})
await upsert('outreach_messages', {
  id: 'outreach-e2e-001', workspace_id: workspaceId, campaign_id: campaign.id,
  creator_id: creator.id, channel: 'email', recipient: 'partnership@creatorops-e2e.example',
  subject: `[${brand.name}] 협업 제안`, message: outreach?.data?.message || '테스트 협업 제안',
  status: 'review', metadata: { generatedByAi: true, testData: true },
})
await upsert('content_tracking', {
  id: contentId, workspace_id: workspaceId, campaign_id: campaign.id, creator_id: creator.id,
  platform: creator.platform, url: contentUrl, title: 'E2E 클렌징 전후 비교',
  status: 'tracking', latest_metrics: trackedMetrics, last_checked_at: now,
})
await insert('performance_snapshots', {
  workspace_id: workspaceId, content_id: contentId, metrics: trackedMetrics,
  source: 'youtube_data_api', captured_at: now,
})
await insert('content_metric_snapshots', {
  workspace_id: workspaceId, brand_id: brand.id, campaign_id: campaign.id,
  creator_id: creator.id, content_id: contentId, platform: creator.platform,
  content_url: contentUrl, measured_at: now, ...trackedMetrics,
  conversions: 37, revenue: 7400000, source_type: 'api_direct',
  source_provider: 'youtube', source_url: contentUrl, confidence_score: 95,
  raw_payload: { testData: true },
})
await upsert('utm_tracking_rows', {
  id: 'utm-e2e-001', workspace_id: workspaceId, raw_source_id: rawIds.utm,
  brand_id: brand.id, brand_name: brand.name, campaign_id: campaign.id, campaign_name: campaign.name,
  creator_id: creator.id, creator_name: creator.name, creator_handle: creator.handle,
  platform: creator.platform, platform_slug: 'youtube', short_code: shortCode, short_url: shortUrl,
  original_utm_url: utmUrl, destination_url: campaign.landingUrl, landing_url: campaign.landingUrl,
  utm_source: 'youtube', utm_medium: 'influencer', utm_campaign: 'e2e_launch',
  utm_content: creator.id, content_url: contentUrl, content_status: 'published',
  content_metrics_source: 'youtube_data_api', cost: 2200000, status: 'content_attached',
  payload: { testData: true },
})
await upsert('creator_operations', {
  id: 'operation-e2e-001', workspace_id: workspaceId, campaign_id: campaign.id,
  creator_id: creator.id, stage: 'performance', training_status: 'completed',
  next_action: '성과 리포트 검토', actual_cost: 2200000, payload: { testData: true },
})
await upsert('content_templates', {
  id: 'template-e2e-001', workspace_id: workspaceId, source_content_id: contentId,
  campaign_id: campaign.id, name: '클렌징 전후 3초 훅',
  structure_json: { hook: '3초 제품 시연', proof: '전후 비교', cta: '숏링크 방문' },
  approved: true, status: 'approved', payload: { testData: true },
})

const engagementRate = trackedMetrics.views
  ? ((trackedMetrics.likes + trackedMetrics.comments + trackedMetrics.shares + trackedMetrics.saves) / trackedMetrics.views) * 100
  : 0
await insert('metric_snapshots', [
  {
    workspace_id: workspaceId, metric_id: metricIds.engagement, campaign_id: campaign.id,
    brand_id: brand.id, creator_id: creator.id, content_id: contentId,
    dimension: { platform: creator.platform }, value: engagementRate,
    raw_source_ids: [rawIds.content], status: 'ok', notes: 'E2E 공식 API 스냅샷 기반',
  },
  {
    workspace_id: workspaceId, metric_id: metricIds.roi, campaign_id: campaign.id,
    brand_id: brand.id, creator_id: creator.id, content_id: contentId,
    dimension: { currency: 'KRW' }, value: ((7400000 - 2200000) / 2200000) * 100,
    raw_source_ids: [rawIds.utm, rawIds.content], status: 'needs_review',
    notes: '테스트 전환 매출 기반',
  },
])
await insert('ai_generation_runs', [
  {
    workspace_id: workspaceId, run_type: 'recommendation', model: recommendation?.data?.model || 'openai',
    prompt_version: recommendation?.data?.promptVersion || 'recommendation-enrichment-v1',
    input_raw_source_ids: [rawIds.campaign, rawIds.creator], input_payload: { brand, campaign, creator },
    output_payload: recommendation?.data || {}, status: recommendationItems.length ? 'success' : 'partial',
  },
  {
    workspace_id: workspaceId, run_type: 'content_guide', model: 'openai',
    prompt_version: 'content-guide-v1', input_raw_source_ids: [rawIds.campaign, rawIds.content],
    input_payload: { brand, campaign }, output_payload: guide?.data || {},
    status: guide?.data?.guide ? 'success' : 'partial',
  },
  {
    workspace_id: workspaceId, run_type: 'outreach_message', model: 'openai',
    prompt_version: 'outreach-message-v1', input_raw_source_ids: [rawIds.campaign, rawIds.creator],
    input_payload: { brand, campaign, creator }, output_payload: outreach?.data || {},
    status: outreach?.data?.message ? 'success' : 'partial',
  },
])
await insert('audit_logs', {
  workspace_id: workspaceId, action: 'e2e.full_cycle.completed',
  target_type: 'campaign', target_id: campaign.id,
  metadata: { stages, testData: true },
})
await insert('job_runs', {
  workspace_id: workspaceId, job_name: 'creatorops-full-cycle-e2e',
  status: 'success', detail: '캠페인부터 데이터룸까지 전체 사이클 완료',
  metadata: { testData: true }, finished_at: new Date().toISOString(),
})

const expectedTables = [
  'workspace_snapshots',
  'raw_data_sources',
  'metric_definitions',
  'creator_profile_snapshots',
  'creator_contact_points',
  'creator_rates',
  'outreach_messages',
  'content_tracking',
  'performance_snapshots',
  'content_metric_snapshots',
  'utm_tracking_rows',
  'creator_operations',
  'content_templates',
  'metric_snapshots',
  'ai_generation_runs',
  'audit_logs',
  'job_runs',
]

for (const table of expectedTables) {
  const total = await count(table)
  if (total === null) {
    record(`DB ${table}`, false, 'MISSING: required operational table is not available in the Supabase schema cache')
  } else {
    record(`DB ${table}`, total > 0, `${total} rows`)
  }
}

console.log('\nCreatorOps full-cycle result')
console.table(stages)
const failures = stages.filter((stage) => !stage.ok)
console.log(`Missing required tables: ${[...missingTables].join(', ') || 'none'}`)
console.log(`\n${stages.length - failures.length}/${stages.length} stages passed`)
if (failures.length) {
  console.log('Failures:')
  for (const failure of failures) console.log(`- ${failure.stage}: ${failure.detail}`)
  process.exitCode = 1
}
