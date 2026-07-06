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
  return { status: 'saved' }
}

const RAW_STATUS_TO_DB = {
  정상: 'ok',
  지연: 'delayed',
  오류: 'error',
  중단: 'paused',
  미수집: 'not_collected',
  부분지원: 'partial',
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
      nextCollectionAt: item.nextCollectionAt || '',
      lastCollectedAt: item.lastCollectedAt || '',
      metricIds: item.metricIds || [],
      notes: item.notes || item.memo || '',
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
    brand_monitor_influencers: 'MET-NOX-INF-001',
    video_monitor_data: 'MET-NOX-VIDEO-001',
    video_monitor_workbench: 'MET-NOX-WB-001',
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
