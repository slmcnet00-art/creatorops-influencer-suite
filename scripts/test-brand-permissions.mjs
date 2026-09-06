const confirmation = process.env.BRAND_PERMISSION_TEST_CONFIRM
const renderApiKey = process.env.RENDER_API_KEY
const renderServiceId = process.env.RENDER_SERVICE_ID

if (confirmation !== 'create-and-delete-temporary-records') {
  throw new Error(
    'Set BRAND_PERMISSION_TEST_CONFIRM=create-and-delete-temporary-records to run the remote permission test.',
  )
}

if (!renderApiKey || !renderServiceId) {
  throw new Error('RENDER_API_KEY and RENDER_SERVICE_ID are required.')
}

const parseResponse = async (response) => {
  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { ok: response.ok, status: response.status, data }
}

const fetchJson = async (url, options = {}) => parseResponse(await fetch(url, options))

const renderEnvResponse = await fetchJson(
  `https://api.render.com/v1/services/${renderServiceId}/env-vars?limit=100`,
  { headers: { Authorization: `Bearer ${renderApiKey}`, Accept: 'application/json' } },
)

if (!renderEnvResponse.ok) {
  throw new Error(`Render environment lookup failed (${renderEnvResponse.status}).`)
}

const renderEnvItems = Array.isArray(renderEnvResponse.data)
  ? renderEnvResponse.data
  : renderEnvResponse.data?.envVars || renderEnvResponse.data?.items || []
const renderEnv = new Map()
for (const item of renderEnvItems) {
  const envVar = item?.envVar || item
  if (envVar?.key) renderEnv.set(envVar.key, envVar.value)
}

const supabaseUrl = renderEnv.get('SUPABASE_URL') || renderEnv.get('VITE_SUPABASE_URL')
const serviceKey = renderEnv.get('SUPABASE_SERVICE_ROLE_KEY')
if (!supabaseUrl || !serviceKey) {
  throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing on Render.')
}

const serviceHeaders = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
}

const restRequest = (path, options = {}, token = serviceKey) => fetchJson(
  `${supabaseUrl}/rest/v1/${path}`,
  {
    ...options,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  },
)

const authAdmin = (path, options = {}) => fetchJson(
  `${supabaseUrl}/auth/v1/admin/${path}`,
  { ...options, headers: { ...serviceHeaders, ...(options.headers || {}) } },
)

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const workspaceId = `permission-test-${suffix}`
const sharedBrand = `shared-${suffix}`
const brandA = `brand-a-${suffix}`
const brandB = `brand-b-${suffix}`
const writeBrandA = `write-a-${suffix}`
const writeBrandB = `write-b-${suffix}`
const password = `Tmp-${crypto.randomUUID()}-Aa1!`
const emails = [
  `permission-a-${suffix}@example.com`,
  `permission-b-${suffix}@example.com`,
]
const userIds = []
const checks = new Map()
let cleanupPassed = false

const expectOk = (result, label) => {
  if (!result.ok) throw new Error(`${label} failed (${result.status}).`)
  return result.data
}

try {
  for (const email of emails) {
    const created = await authAdmin('users', {
      method: 'POST',
      body: JSON.stringify({ email, password, email_confirm: true }),
    })
    const user = expectOk(created, 'Temporary user creation')
    userIds.push(user.id)
  }

  expectOk(await restRequest('workspaces', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ id: workspaceId, name: 'Permission isolation test' }),
  }), 'Workspace creation')

  expectOk(await restRequest('workspace_members', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify([
      { workspace_id: workspaceId, user_id: userIds[0], role: 'Marketer', status: 'active' },
      { workspace_id: workspaceId, user_id: userIds[1], role: 'Client', status: 'active' },
    ]),
  }), 'Workspace member creation')

  expectOk(await restRequest('brand_memberships', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify([
      { workspace_id: workspaceId, brand_id: sharedBrand, user_id: userIds[0], role: 'Marketer', status: 'active' },
      { workspace_id: workspaceId, brand_id: sharedBrand, user_id: userIds[1], role: 'Client', status: 'active' },
      { workspace_id: workspaceId, brand_id: brandA, user_id: userIds[0], role: 'Marketer', status: 'active' },
      { workspace_id: workspaceId, brand_id: brandB, user_id: userIds[1], role: 'Client', status: 'active' },
      { workspace_id: workspaceId, brand_id: writeBrandA, user_id: userIds[0], role: 'Marketer', status: 'active' },
      { workspace_id: workspaceId, brand_id: writeBrandB, user_id: userIds[1], role: 'Client', status: 'active' },
    ]),
  }), 'Brand membership creation')

  expectOk(await restRequest('brand_scoped_snapshots', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify([
      { workspace_id: workspaceId, brand_id: sharedBrand, payload: { scope: 'shared' } },
      { workspace_id: workspaceId, brand_id: brandA, payload: { scope: 'a-only' } },
      { workspace_id: workspaceId, brand_id: brandB, payload: { scope: 'b-only' } },
    ]),
  }), 'Snapshot seed creation')

  const tokens = []
  for (const email of emails) {
    const login = await fetchJson(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: serviceKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    tokens.push(expectOk(login, 'Temporary user login').access_token)
  }

  const query = `brand_scoped_snapshots?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=brand_id`
  const rowsA = expectOk(await restRequest(query, {}, tokens[0]), 'User A snapshot read') || []
  const rowsB = expectOk(await restRequest(query, {}, tokens[1]), 'User B snapshot read') || []
  const brandsA = new Set(rowsA.map((row) => row.brand_id))
  const brandsB = new Set(rowsB.map((row) => row.brand_id))

  checks.set('SHARED_BRAND_VISIBLE_TO_A', brandsA.has(sharedBrand))
  checks.set('SHARED_BRAND_VISIBLE_TO_B', brandsB.has(sharedBrand))
  checks.set('A_ONLY_BRAND_ISOLATED', brandsA.has(brandA) && !brandsA.has(brandB))
  checks.set('B_ONLY_BRAND_ISOLATED', brandsB.has(brandB) && !brandsB.has(brandA))

  const marketerWrite = await restRequest('brand_scoped_snapshots', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ workspace_id: workspaceId, brand_id: writeBrandA, payload: { role: 'marketer' } }),
  }, tokens[0])
  checks.set('MARKETER_WRITE_ALLOWED', marketerWrite.ok)

  const clientWrite = await restRequest('brand_scoped_snapshots', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ workspace_id: workspaceId, brand_id: writeBrandB, payload: { role: 'client' } }),
  }, tokens[1])
  checks.set('CLIENT_WRITE_BLOCKED', !clientWrite.ok && [401, 403].includes(clientWrite.status))
} finally {
  if (supabaseUrl && serviceKey) {
    const cleanupResults = [
      await restRequest(`workspaces?id=eq.${encodeURIComponent(workspaceId)}`, { method: 'DELETE' }),
    ]
    for (const userId of userIds) {
      cleanupResults.push(await authAdmin(`users/${userId}`, { method: 'DELETE' }))
    }
    cleanupPassed = cleanupResults.every((result) => result.ok)
  }
}

for (const [name, passed] of checks) {
  console.log(`${name}=${passed ? 'PASS' : 'FAIL'}`)
}
console.log(`CLEANUP=${cleanupPassed ? 'PASS' : 'FAIL'}`)

if ([...checks.values()].some((passed) => !passed) || !cleanupPassed) process.exitCode = 1
