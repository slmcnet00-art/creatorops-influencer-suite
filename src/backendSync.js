import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const WORKSPACE_ID = import.meta.env.VITE_WORKSPACE_ID || 'miping-main'
const APP_URL = import.meta.env.VITE_APP_URL || 'https://creatorops-influencer-suite.onrender.com'

let supabaseClient

function getAuthRedirectUrl() {
  const origin = window.location.origin
  const hostname = window.location.hostname
  if (hostname === 'localhost' || hostname === '127.0.0.1') return APP_URL
  return origin || APP_URL
}

export function getBackendConfig() {
  return {
    hasSupabase: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
    workspaceId: WORKSPACE_ID,
    apiBaseUrl: import.meta.env.VITE_CREATOROPS_API_BASE_URL || '',
  }
}

function getCreatorOpsApiUrl(path) {
  const baseUrl = import.meta.env.VITE_CREATOROPS_API_BASE_URL || ''
  if (!baseUrl) return path
  return `${baseUrl.replace(/\/$/, '')}${path}`
}

export async function loadDataRoomApiStatus() {
  try {
    const response = await fetch(getCreatorOpsApiUrl('/data-room/status'))
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      return {
        ok: false,
        message: payload.message || `API status check failed with ${response.status}.`,
        payload,
      }
    }
    return {
      ok: Boolean(payload.ok),
      message: payload.message || '',
      payload,
    }
  } catch (error) {
    return {
      ok: false,
      message: error.message || 'Data room API status check failed.',
      payload: null,
    }
  }
}

export function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  }
  return supabaseClient
}

export async function getAuthSession() {
  const supabase = getSupabaseClient()
  if (!supabase) return null
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export async function signInWithEmail(email) {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return { status: 'local', message: 'Supabase env is not configured.' }
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: getAuthRedirectUrl(),
    },
  })
  if (error) throw error
  return { status: 'sent' }
}

export async function signUpWithPassword({ email, password, fullName, companyName }) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase 환경변수가 설정되지 않았습니다.')

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getAuthRedirectUrl(),
      data: {
        full_name: fullName,
        company_name: companyName,
      },
    },
  })
  if (error) throw error
  return {
    session: data.session,
    user: data.user,
    needsEmailConfirmation: !data.session,
  }
}

export async function signInWithPassword({ email, password }) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase 환경변수가 설정되지 않았습니다.')
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function requestPasswordReset(email) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase 환경변수가 설정되지 않았습니다.')
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getAuthRedirectUrl().replace(/\/$/, '')}/login`,
  })
  if (error) throw error
  return { status: 'sent' }
}

export async function getCurrentWorkspaceAccess() {
  const supabase = getSupabaseClient()
  if (!supabase) return { configured: false, membership: null, brands: [] }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  const user = sessionData.session?.user
  if (!user) return { configured: true, membership: null, brands: [] }

  const { data: memberships, error: membershipError } = await supabase
    .from('workspace_members')
    .select('workspace_id, user_id, role, status, invited_email')
    .eq('workspace_id', WORKSPACE_ID)
    .eq('user_id', user.id)
    .limit(1)
  if (membershipError) throw membershipError

  const membership = memberships?.[0] || null
  if (!membership || membership.status !== 'active') {
    return { configured: true, membership, brands: [], user }
  }

  if (membership.role === 'Owner' || membership.role === 'Admin') {
    return { configured: true, membership, brands: ['*'], user }
  }

  const { data: brandRows, error: brandError } = await supabase
    .from('brand_memberships')
    .select('brand_id, role, status')
    .eq('workspace_id', WORKSPACE_ID)
    .eq('user_id', user.id)
    .eq('status', 'active')
  if (brandError) throw brandError

  return {
    configured: true,
    membership,
    brands: (brandRows || []).map((row) => row.brand_id),
    user,
  }
}

export async function signOut() {
  const supabase = getSupabaseClient()
  if (!supabase) return { status: 'local' }
  const { error } = await supabase.auth.signOut()
  if (error) throw error
  return { status: 'signed_out' }
}

export function onAuthStateChange(callback) {
  const supabase = getSupabaseClient()
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((event, session) => callback(event, session))
  return () => data.subscription.unsubscribe()
}

async function ensureWorkspaceMembership(supabase, workspace) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  const user = sessionData.session?.user
  if (!user) return { status: 'anonymous' }

  const workspaceName = workspace?.team?.name || workspace?.brands?.[0]?.name || WORKSPACE_ID
  const { error: workspaceError } = await supabase
    .from('workspaces')
    .upsert(
      {
        id: WORKSPACE_ID,
        name: workspaceName,
        owner_id: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
  if (workspaceError) throw workspaceError

  const { error: memberError } = await supabase
    .from('workspace_members')
    .upsert(
      {
        workspace_id: WORKSPACE_ID,
        user_id: user.id,
        role: 'Owner',
        invited_email: user.email,
        status: 'active',
      },
      { onConflict: 'workspace_id,user_id' },
    )
  if (memberError) throw memberError

  return { status: 'ready', user }
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const parsed = Number(String(value).replace(/[^\d.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function getUtmParam(log = {}, key) {
  return log[key] || log.utmParams?.[key] || ''
}

function toIsoTimestamp(value) {
  if (!value) return new Date().toISOString()
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString()
  return parsed.toISOString()
}

function toUtmStatus(value, hasContentUrl = false) {
  const allowedStatuses = new Set(['link_created', 'content_attached', 'paused', 'archived'])
  if (allowedStatuses.has(value)) return value
  return hasContentUrl ? 'content_attached' : 'link_created'
}

function normalizeUtmTrackingRow(log = {}, index = 0) {
  const campaignId = log.campaignId || log.campaign_id || ''
  const creatorId = log.creatorId || log.creator_id || ''
  const shortCode = log.shortCode || log.short_code || ''
  const id = log.id || `utm-${campaignId || 'campaign'}-${creatorId || index}-${shortCode || index}`
  const createdAt = toIsoTimestamp(log.createdAt || log.created_at)
  const updatedAt = toIsoTimestamp(log.updatedAt || log.updated_at || createdAt)
  const contentUrl = log.contentUrl || log.content_url || ''

  return {
    id,
    workspace_id: WORKSPACE_ID,
    raw_source_id: log.rawId || log.raw_source_id || 'RAW-INT-UTM-001',
    brand_id: log.brandId || log.brand_id || null,
    brand_name: log.brandName || log.brand_name || null,
    campaign_id: campaignId || null,
    campaign_name: log.campaignName || log.campaign_name || null,
    creator_id: creatorId || null,
    creator_name: log.creatorName || log.creator_name || null,
    creator_handle: log.creatorHandle || log.creator_handle || null,
    platform: log.platform || null,
    platform_slug: log.platformSlug || log.platform_slug || null,
    short_code: shortCode || null,
    short_url: log.shortUrl || log.short_url || null,
    original_utm_url: log.originalUrl || log.original_utm_url || null,
    destination_url: log.destination || log.destination_url || null,
    landing_url: log.landingUrl || log.landing_url || log.destination || log.destination_url || null,
    coupon_code: log.couponCode || log.coupon_code || null,
    utm_source: getUtmParam(log, 'utm_source') || null,
    utm_medium: getUtmParam(log, 'utm_medium') || 'influencer',
    utm_campaign: getUtmParam(log, 'utm_campaign') || null,
    utm_content: getUtmParam(log, 'utm_content') || null,
    content_url: contentUrl || null,
    content_title: log.contentTitle || log.content_title || null,
    content_status: log.contentStatus || log.content_status || (contentUrl ? 'registered' : null),
    content_metrics_source: log.contentMetricsSource || log.content_metrics_source || null,
    cost: toNumberOrNull(log.cost ?? log.creator_cost),
    status: toUtmStatus(log.status, Boolean(contentUrl)),
    payload: log,
    created_at: createdAt,
    updated_at: updatedAt,
  }
}

async function syncUtmTrackingRowsForWorkspace(supabase, workspace = {}) {
  const logs = Array.isArray(workspace.utmTrackingLogs) ? workspace.utmTrackingLogs : []
  const rows = logs.map(normalizeUtmTrackingRow)

  for (let index = 0; index < rows.length; index += 500) {
    const { error } = await supabase.from('utm_tracking_rows').upsert(rows.slice(index, index + 500), { onConflict: 'id' })
    if (error) throw error
  }

  return { status: 'synced', rowCount: rows.length }
}

function getWorkspaceCreators(workspace = {}) {
  const creators = Array.isArray(workspace.creators) ? workspace.creators : []
  const recommendations = Array.isArray(workspace.recommendations) ? workspace.recommendations : []
  const merged = new Map()

  ;[...creators, ...recommendations].forEach((creator, index) => {
    if (!creator) return
    const id = String(creator.id || creator.creatorId || creator.handle || creator.profileUrl || `creator-${index}`)
    merged.set(id, { ...(merged.get(id) || {}), ...creator, id })
  })

  return [...merged.values()]
}

function normalizePlatform(value) {
  const platform = String(value || '').trim()
  return platform || null
}

function normalizeSnapshotSourceType(value) {
  const allowed = new Set([
    'api_direct',
    'api_authorized',
    'public_snapshot',
    'manual',
    'calculated',
    'ai_derived',
  ])
  return allowed.has(value) ? value : 'manual'
}

async function replaceWorkspaceGeneratedRows(supabase, table, rows) {
  const { error: deleteError } = await supabase
    .from(table)
    .delete()
    .eq('workspace_id', WORKSPACE_ID)
    .contains('metadata', { syncSource: 'workspace_snapshot' })
  if (deleteError) throw deleteError

  for (let index = 0; index < rows.length; index += 500) {
    const { error } = await supabase.from(table).insert(rows.slice(index, index + 500))
    if (error) throw error
  }
}

async function syncCreatorOperationsForWorkspace(supabase, workspace = {}) {
  const creators = getWorkspaceCreators(workspace)
  const contactRows = []
  const rateRows = []
  const today = new Date().toISOString().slice(0, 10)

  creators.forEach((creator) => {
    const creatorId = String(creator.id)
    const brandId = creator.brandId || workspace.activeBrandId || null
    const profileUrl = creator.profileUrl || creator.sourceUrl || ''
    const email = creator.contactEmail || creator.email || ''

    if (email) {
      contactRows.push({
        workspace_id: WORKSPACE_ID,
        brand_id: brandId,
        creator_id: creatorId,
        contact_type: 'email',
        contact_value: email,
        source_url: profileUrl || null,
        verification_status: creator.emailVerified ? 'verified' : 'unverified',
        verified_at: creator.emailVerified ? new Date().toISOString() : null,
        metadata: {
          syncSource: 'workspace_snapshot',
          platform: creator.platform || null,
          handle: creator.handle || null,
        },
      })
    }

    if (profileUrl) {
      const platform = String(creator.platform || '').toLowerCase()
      const contactType = platform.includes('instagram')
        ? 'instagram_dm'
        : platform.includes('tiktok')
          ? 'tiktok_dm'
          : platform.includes('youtube')
            ? 'youtube_profile'
            : 'other'
      contactRows.push({
        workspace_id: WORKSPACE_ID,
        brand_id: brandId,
        creator_id: creatorId,
        contact_type: contactType,
        contact_value: profileUrl,
        source_url: profileUrl,
        verification_status: 'unverified',
        metadata: {
          syncSource: 'workspace_snapshot',
          platform: creator.platform || null,
          handle: creator.handle || null,
        },
      })
    }

    const estimated = toNumberOrNull(
      creator.estimatedPrice ?? creator.estimatedCost ?? creator.unitPrice ?? creator.price,
    )
    const agreed = toNumberOrNull(
      creator.actualPrice ?? creator.agreedAmount ?? creator.contractAmount,
    )
    if (estimated !== null || agreed !== null) {
      rateRows.push({
        workspace_id: WORKSPACE_ID,
        brand_id: brandId,
        creator_id: creatorId,
        platform: normalizePlatform(creator.platform),
        content_format: creator.contentFormat || creator.format || null,
        currency: creator.currency || 'KRW',
        estimated_min: toNumberOrNull(creator.estimatedMin) ?? estimated,
        estimated_max: toNumberOrNull(creator.estimatedMax) ?? estimated,
        agreed_amount: agreed,
        rate_source:
          agreed !== null
            ? creator.rateSource === 'contract' || creator.rateSource === 'creator_quote'
              ? creator.rateSource
              : 'manual'
            : 'calculated',
        effective_from: creator.rateEffectiveFrom || today,
        effective_to: creator.rateEffectiveTo || null,
        calculation_version: creator.rateCalculationVersion || 'workspace-v1',
        source_raw_ids: Array.isArray(creator.rateSourceRawIds) ? creator.rateSourceRawIds : [],
        metadata: {
          syncSource: 'workspace_snapshot',
          handle: creator.handle || null,
          displayName: creator.name || null,
          effectivePrice: agreed ?? estimated,
          rateFormula: creator.rateFormula || null,
          rateFactors: creator.rateFactors || null,
          rateHistory: Array.isArray(creator.rateHistory) ? creator.rateHistory.slice(-20) : [],
          rateUpdatedAt: creator.rateUpdatedAt || null,
        },
      })
    }
  })

  await replaceWorkspaceGeneratedRows(supabase, 'creator_contact_points', contactRows)
  await replaceWorkspaceGeneratedRows(supabase, 'creator_rates', rateRows)

  return {
    status: 'synced',
    contactRowCount: contactRows.length,
    rateRowCount: rateRows.length,
  }
}

async function getRawWriteContext() {
  const supabase = getSupabaseClient()
  if (!supabase) return { status: 'local', supabase: null }

  const membership = await ensureWorkspaceMembership(supabase)
  if (membership.status === 'anonymous') {
    return { status: 'auth_required', supabase: null }
  }

  return { status: 'ready', supabase }
}

export async function saveCreatorProfileRawSnapshot(snapshot = {}) {
  const context = await getRawWriteContext()
  if (context.status !== 'ready') return { status: context.status }

  const { error } = await context.supabase.from('creator_profile_snapshots').insert({
    workspace_id: WORKSPACE_ID,
    brand_id: snapshot.brandId || null,
    creator_id: String(snapshot.creatorId || snapshot.id || ''),
    platform: normalizePlatform(snapshot.platform) || 'unknown',
    handle: snapshot.handle || null,
    profile_url: snapshot.profileUrl || snapshot.sourceUrl || null,
    display_name: snapshot.name || snapshot.displayName || null,
    bio: snapshot.bio || null,
    profile_image_url: snapshot.avatar || snapshot.profileImageUrl || null,
    followers_count: toNumberOrNull(snapshot.followers),
    subscribers_count: toNumberOrNull(snapshot.subscribers),
    content_count: toNumberOrNull(snapshot.contentCount),
    total_views: toNumberOrNull(snapshot.totalViews),
    country_code: snapshot.country || null,
    source_type: normalizeSnapshotSourceType(snapshot.sourceType),
    source_provider: snapshot.sourceProvider || null,
    source_url: snapshot.sourceUrl || snapshot.profileUrl || null,
    confidence_score: toNumberOrNull(snapshot.confidence),
    collected_at: snapshot.collectedAt || new Date().toISOString(),
    raw_payload: snapshot.rawPayload || snapshot,
  })

  if (error) throw error
  return { status: 'saved' }
}

export async function saveContentMetricRawSnapshot(snapshot = {}) {
  const context = await getRawWriteContext()
  if (context.status !== 'ready') return { status: context.status }
  const contentUrl = snapshot.contentUrl || snapshot.url
  if (!contentUrl) return { status: 'invalid', message: 'A content URL is required.' }

  const { error } = await context.supabase.from('content_metric_snapshots').insert({
    workspace_id: WORKSPACE_ID,
    brand_id: snapshot.brandId || null,
    campaign_id: snapshot.campaignId || null,
    creator_id: snapshot.creatorId ? String(snapshot.creatorId) : null,
    content_id: String(snapshot.contentId || snapshot.id || contentUrl),
    platform: normalizePlatform(snapshot.platform) || 'unknown',
    content_url: contentUrl,
    published_at: snapshot.publishedAt || null,
    measured_at: snapshot.collectedAt || snapshot.measuredAt || new Date().toISOString(),
    views: toNumberOrNull(snapshot.views),
    likes: toNumberOrNull(snapshot.likes),
    comments: toNumberOrNull(snapshot.comments),
    shares: toNumberOrNull(snapshot.shares),
    saves: toNumberOrNull(snapshot.saves),
    conversions: toNumberOrNull(snapshot.conversions),
    revenue: toNumberOrNull(snapshot.revenue),
    source_type: normalizeSnapshotSourceType(snapshot.sourceType),
    source_provider: snapshot.sourceProvider || null,
    source_url: snapshot.sourceUrl || contentUrl,
    confidence_score: toNumberOrNull(snapshot.confidence),
    raw_payload: snapshot.rawPayload || snapshot,
  })

  if (error) throw error
  return { status: 'saved' }
}

export async function loadCloudWorkspace() {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return { status: 'local', workspace: null, message: 'Supabase env is not configured.' }
  }

  const membership = await ensureWorkspaceMembership(supabase)
  if (membership.status === 'anonymous') {
    return { status: 'auth_required', workspace: null, message: 'Sign in to load the shared workspace.' }
  }

  const { data, error } = await supabase
    .from('workspace_snapshots')
    .select('workspace_id,payload,updated_at')
    .eq('workspace_id', WORKSPACE_ID)
    .maybeSingle()

  if (error) throw error
  return {
    status: data?.payload ? 'loaded' : 'empty',
    workspace: data?.payload ?? null,
    updatedAt: data?.updated_at ?? null,
  }
}

export async function saveCloudWorkspace(workspace) {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return { status: 'local', message: 'Supabase env is not configured.' }
  }

  const membership = await ensureWorkspaceMembership(supabase, workspace)
  if (membership.status === 'anonymous') {
    return { status: 'auth_required', message: 'Sign in to save the shared workspace.' }
  }

  const { error } = await supabase
    .from('workspace_snapshots')
    .upsert(
      {
        workspace_id: WORKSPACE_ID,
        payload: workspace,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id' },
    )

  if (error) throw error

  let dataRoomRawSync
  let creatorOperationsSync
  try {
    dataRoomRawSync = await syncUtmTrackingRowsForWorkspace(supabase, workspace)
  } catch (syncError) {
    dataRoomRawSync = {
      status: 'failed',
      rowCount: Array.isArray(workspace?.utmTrackingLogs) ? workspace.utmTrackingLogs.length : 0,
      message: syncError.message || 'UTM raw sync failed.',
    }
  }

  try {
    creatorOperationsSync = await syncCreatorOperationsForWorkspace(supabase, workspace)
  } catch (syncError) {
    creatorOperationsSync = {
      status: 'failed',
      contactRowCount: 0,
      rateRowCount: 0,
      message: syncError.message || 'Creator operations raw sync failed.',
    }
  }

  return { status: 'saved', dataRoomRawSync, creatorOperationsSync }
}

const RAW_STATUS_TO_DB = {
  정상: 'ok',
  지연: 'delayed',
  오류: 'error',
  중단: 'paused',
  미수집: 'not_collected',
  부분수집: 'partial',
  '검증 필요': 'needs_review',
}

const METRIC_STATUS_TO_DB = {
  정상: 'ok',
  지연: 'delayed',
  오류: 'error',
  '검증 필요': 'needs_review',
}

function toScopeValue(scope) {
  return scope === '내부' ? 'internal' : 'external'
}

function toRawStatusValue(status) {
  return RAW_STATUS_TO_DB[status] || 'needs_review'
}

function toMetricStatusValue(status) {
  return METRIC_STATUS_TO_DB[status] || 'needs_review'
}

function createImportId(reportType, fileName = '') {
  const seed = `${reportType}-${fileName}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  return seed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120)
}

function createSourceKey(payload = {}) {
  const preferredKeys = [
    'url',
    'URL',
    'Video URL',
    '영상 URL',
    'Channel URL',
    '채널 URL',
    'Influencer',
    '인플루언서',
    'Creator',
    '크리에이터',
    'Brand',
    '브랜드',
    'Title',
    '제목',
  ]
  const value = preferredKeys.map((key) => payload[key]).find(Boolean)
  if (value) return String(value).slice(0, 500)
  return Object.values(payload).filter(Boolean).slice(0, 3).join(' | ').slice(0, 500)
}

export async function syncDataRoomRegistry(rawData = [], metrics = []) {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return { status: 'local', message: 'Supabase env is not configured.' }
  }

  const membership = await ensureWorkspaceMembership(supabase)
  if (membership.status === 'anonymous') {
    return { status: 'auth_required', message: 'Sign in to sync the data room registry.' }
  }

  const now = new Date().toISOString()
  const rawRows = rawData.map((item) => ({
    id: item.id,
    workspace_id: WORKSPACE_ID,
    scope: toScopeValue(item.scope),
    category: item.category,
    name: item.name,
    description: item.description || '',
    collection_method: item.method || '',
    collection_cycle: item.cycle || '',
    source_location: item.sourceLocation || '',
    storage_location: item.storageLocation || '',
    dashboard_area: item.dashboardArea || '',
    owner_dept: item.ownerDept || '',
    ops_owner: item.opsOwner || '',
    tech_owner: item.techOwner || '',
    status: toRawStatusValue(item.status),
    quality_issue: item.qualityIssue || '',
    log_location: item.logLocation || '',
    active: item.status !== '중단',
    metadata: {
      purpose: item.purpose || '',
      nextCollectionAt: item.nextCollectionAt || item.nextCollectAt || '',
      lastCollectedAt: item.lastCollectedAt || '',
      metricIds: item.metricIds || [],
      schemaFields: item.schemaFields || [],
      notes: item.notes || item.note || item.memo || '',
    },
    updated_at: now,
  }))

  if (rawRows.length) {
    const { error } = await supabase.from('raw_data_sources').upsert(rawRows, { onConflict: 'id' })
    if (error) throw error
  }

  const metricRows = metrics.map((item) => ({
    id: item.id,
    workspace_id: WORKSPACE_ID,
    scope: toScopeValue(item.scope),
    bundle: item.bundle,
    name: item.name,
    description: item.description || '',
    formula: item.formula || '',
    raw_source_ids: item.rawIds || [],
    period: item.period || '',
    refresh_cycle: item.refreshCycle || item.cycle || '',
    display_location: item.displayLocation || '',
    interpretation: item.interpretation || '',
    outlier_rule: item.outlierRule || '',
    reliability: item.reliability || '',
    owner_dept: item.ownerDept || '',
    status: toMetricStatusValue(item.status),
    metadata: {
      rawNames: item.rawNames || [],
      notes: item.notes || item.memo || '',
    },
    updated_at: now,
  }))

  if (metricRows.length) {
    const { error } = await supabase.from('metric_definitions').upsert(metricRows, { onConflict: 'id' })
    if (error) throw error
  }

  return { status: 'synced', rawCount: rawRows.length, metricCount: metricRows.length, updatedAt: now }
}

export async function importExternalReport({ reportType = 'custom', sourceName = 'External report', originalFileName = '', rawSourceId = null, sheets = [] }) {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return { status: 'local', message: 'Supabase env is not configured.' }
  }

  const membership = await ensureWorkspaceMembership(supabase)
  if (membership.status === 'anonymous') {
    return { status: 'auth_required', message: 'Sign in to import external reports.' }
  }

  const importId = createImportId(reportType, originalFileName)
  const rowCount = sheets.reduce((total, sheet) => total + sheet.rows.length, 0)
  const startedAt = new Date().toISOString()

  const { error: importError } = await supabase.from('external_report_imports').insert({
    id: importId,
    workspace_id: WORKSPACE_ID,
    report_type: reportType,
    source_name: sourceName,
    original_file_name: originalFileName,
    imported_by: membership.user.id,
    status: 'parsing',
    row_count: 0,
    sheet_count: sheets.length,
    parse_summary: {
      sheetNames: sheets.map((sheet) => sheet.sheetName),
      startedAt,
    },
  })
  if (importError) throw importError

  const rows = sheets.flatMap((sheet) =>
    sheet.rows.map((row) => ({
      workspace_id: WORKSPACE_ID,
      import_id: importId,
      raw_source_id: rawSourceId,
      report_type: reportType,
      sheet_name: sheet.sheetName,
      row_index: row.rowIndex,
      source_key: row.sourceKey || createSourceKey(row.payload),
      payload: row.payload,
      normalized_type: row.normalizedType || null,
      normalized_ref: row.normalizedRef || null,
      quality_status: row.qualityStatus || 'needs_review',
      quality_notes: row.qualityNotes || 'Imported from external monitoring report; normalization pending.',
    })),
  )

  for (let index = 0; index < rows.length; index += 500) {
    const { error: rowError } = await supabase.from('external_report_rows').insert(rows.slice(index, index + 500))
    if (rowError) throw rowError
  }

  const parsedAt = new Date().toISOString()
  const { error: updateError } = await supabase
    .from('external_report_imports')
    .update({
      status: 'parsed',
      row_count: rowCount,
      sheet_count: sheets.length,
      parse_summary: {
        sheetNames: sheets.map((sheet) => sheet.sheetName),
        rowCounts: Object.fromEntries(sheets.map((sheet) => [sheet.sheetName, sheet.rows.length])),
        parsedAt,
      },
      parsed_at: parsedAt,
    })
    .eq('id', importId)
  if (updateError) throw updateError

  const metricByReportType = {
    video_monitor_workbench: 'MET-EXT-WB-001',
  }
  const metricId = metricByReportType[reportType]
  if (metricId && rowCount) {
    await supabase.from('metric_snapshots').insert({
      workspace_id: WORKSPACE_ID,
      metric_id: metricId,
      dimension: {
        importId,
        reportType,
        sourceName,
        originalFileName,
      },
      value: rowCount,
      value_json: {
        sheetCount: sheets.length,
        rowCount,
      },
      raw_source_ids: rawSourceId ? [rawSourceId] : [],
      status: 'needs_review',
      notes: 'External report import row count snapshot. Detailed metric normalization should run after schema validation.',
    })
  }

  return { status: 'imported', importId, rowCount, sheetCount: sheets.length, parsedAt }
}

export async function loadExternalSearchEvents(limit = 20) {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return { status: 'local', events: [], message: 'Supabase env is not configured.' }
  }

  const membership = await ensureWorkspaceMembership(supabase)
  if (membership.status === 'anonymous') {
    return { status: 'auth_required', events: [], message: 'Sign in to load external API events.' }
  }

  const { data, error } = await supabase
    .from('external_search_events')
    .select('id,raw_source_id,provider,endpoint,query,platform,country,result_count,status,error_message,created_at')
    .eq('workspace_id', WORKSPACE_ID)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return { status: 'loaded', events: data || [] }
}
