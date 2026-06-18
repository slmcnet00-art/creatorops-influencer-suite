import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const WORKSPACE_ID = import.meta.env.VITE_WORKSPACE_ID || 'miping-main'

let supabaseClient

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

export async function loadCloudWorkspace() {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return { status: 'local', workspace: null, message: 'Supabase env is not configured.' }
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
