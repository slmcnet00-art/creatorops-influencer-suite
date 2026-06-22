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
      emailRedirectTo: window.location.origin,
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
