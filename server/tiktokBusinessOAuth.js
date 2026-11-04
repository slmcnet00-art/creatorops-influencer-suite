import { createHash, randomBytes } from 'node:crypto'
import { apiError, readSettings, updateSettings, seal, unseal } from './integrationStore.js'

const kinds = new Set(['advertiser', 'account'])
const digest = value => createHash('sha256').update(value).digest('hex')
const page = message => `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CreatorOps · TikTok 연결</title><body><h1>CreatorOps · TikTok 연결</h1><p>${message}</p><p><a href="https://creatorops-influencer-suite.onrender.com/">CreatorOps로 돌아가기</a></p></body></html>`

export function createTikTokBusinessOAuth({ getClient, workspaceId, env = process.env, fetchImpl = fetch, now = Date.now, audit = async () => {}, store }) {
  const apiBase = String(env.CREATOROPS_PUBLIC_API_URL || 'https://creatorops-suite-api.onrender.com').replace(/\/$/, '')
  const frontend = 'https://creatorops-influencer-suite.onrender.com'
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(apiBase)) throw Error('TikTok OAuth public API URL must be a fixed HTTPS origin.')
  const registration = {
    appIconUrl: `${frontend}/creatorops-app-icon.png`, websiteUrl: frontend,
    privacyUrl: `${frontend}/privacy`, termsUrl: `${frontend}/terms`,
    advertiserRedirectUrl: `${apiBase}/oauth/tiktok/advertiser/callback`,
    accountRedirectUrl: `${apiBase}/oauth/tiktok/account/callback`,
  }
  const storage = store || {
    async read() {
      const row = await readSettings(getClient(), workspaceId)
      return row.settings?.tiktokBusinessOAuthVault ? unseal(row.settings.tiktokBusinessOAuthVault, env) : { pending: {}, connections: {} }
    },
    async update(fn) {
      return updateSettings(getClient(), workspaceId, settings => {
        const value = settings.tiktokBusinessOAuthVault ? unseal(settings.tiktokBusinessOAuthVault, env) : { pending: {}, connections: {} }
        fn(value)
        return { ...settings, tiktokBusinessOAuthVault: seal(value, env) }
      })
    },
  }
  const assertKind = kind => { if (!kinds.has(kind)) throw apiError(404, '지원하지 않는 TikTok 인증 종류입니다.') }
  const redirectFor = kind => kind === 'advertiser' ? registration.advertiserRedirectUrl : registration.accountRedirectUrl
  function credentials() {
    const id = String(env.TIKTOK_BUSINESS_APP_ID || '').trim()
    const secret = String(env.TIKTOK_BUSINESS_APP_SECRET || '').trim()
    if (!id || !secret) throw apiError(503, 'TikTok Business App ID와 Secret을 서버에 등록해야 합니다.')
    return { id, secret }
  }
  async function begin(kind, actorId) {
    assertKind(kind)
    if (!actorId) throw apiError(401, '관리자 로그인이 필요합니다.')
    const { id } = credentials()
    const scope = String(env.TIKTOK_BUSINESS_ACCOUNT_SCOPES || '').trim()
    if (kind === 'account' && !scope) throw apiError(503, '승인된 TikTok 계정 권한 범위를 서버에 설정해야 합니다.')
    const state = randomBytes(32).toString('hex'), createdAt = now()
    await storage.update(value => {
      value.pending ||= {}
      for (const [key, item] of Object.entries(value.pending)) if (item.expiresAt <= createdAt) delete value.pending[key]
      if (Object.keys(value.pending).length >= 20) throw apiError(429, '진행 중인 인증이 많습니다. 잠시 후 다시 시작하세요.')
      value.pending[digest(state)] = { kind, actorId, expiresAt: createdAt + 600000, redirectUri: redirectFor(kind) }
    })
    const url = new URL(kind === 'advertiser' ? 'https://business-api.tiktok.com/portal/auth' : 'https://www.tiktok.com/v2/auth/authorize/')
    url.searchParams.set(kind === 'advertiser' ? 'app_id' : 'client_key', id)
    url.searchParams.set('state', state)
    url.searchParams.set('redirect_uri', redirectFor(kind))
    if (kind === 'account') { url.searchParams.set('response_type', 'code'); url.searchParams.set('scope', scope) }
    return { url: url.toString(), expiresIn: 600 }
  }
  async function complete(kind, query = {}) {
    assertKind(kind)
    const state = typeof query.state === 'string' ? query.state : ''
    const code = typeof query.auth_code === 'string' ? query.auth_code : typeof query.code === 'string' ? query.code : ''
    if (query.error) throw apiError(403, 'TikTok 인증이 취소되었습니다.')
    if (!/^[a-f0-9]{64}$/.test(state) || !code || code.length > 4096) throw apiError(400, 'CreatorOps에서 인증을 다시 시작하세요.')
    let pending
    // CAS consumes the state before any one-use code exchange; replay and cross-flow callbacks fail closed.
    await storage.update(value => {
      const item = value.pending?.[digest(state)]
      if (!item || item.kind !== kind || item.expiresAt <= now() || item.redirectUri !== redirectFor(kind)) throw apiError(400, '인증 요청이 만료되었거나 이미 사용되었습니다.')
      pending = item
      delete value.pending[digest(state)]
    })
    const { id, secret } = credentials()
    const body = kind === 'advertiser' ? { app_id: id, secret, auth_code: code }
      : { client_id: id, client_secret: secret, grant_type: 'authorization_code', auth_code: code, redirect_uri: redirectFor(kind) }
    let payload
    try {
      const response = await fetchImpl(`https://business-api.tiktok.com/open_api/v1.3/${kind === 'advertiser' ? 'oauth2/access_token/' : 'tt_user/oauth2/token/'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) throw Error('exchange failed')
      payload = await response.json()
      if (payload.code !== 0 || typeof payload.data?.access_token !== 'string' || !payload.data.access_token) throw Error('exchange rejected')
    } catch { throw apiError(502, 'TikTok 인증 교환을 완료하지 못했습니다. 새 연결 요청으로 다시 시작하세요.') }
    const data = payload.data
    const advertiserIds = kind === 'advertiser' && Array.isArray(data.advertiser_ids) ? data.advertiser_ids.map(value => {
      if (typeof value === 'number' && !Number.isSafeInteger(value)) throw apiError(502, '광고 계정 ID 형식을 확인할 수 없습니다.')
      if (!/^\d+$/.test(String(value))) throw apiError(502, '광고 계정 ID 형식을 확인할 수 없습니다.')
      return String(value)
    }) : []
    if (kind === 'advertiser' && !advertiserIds.length) throw apiError(502, '승인된 광고 계정이 없습니다.')
    if (kind === 'account' && (typeof data.open_id !== 'string' || !data.open_id)) throw apiError(502, '승인된 TikTok 계정을 확인할 수 없습니다.')
    const identity = kind === 'advertiser' ? [...advertiserIds].sort().join(',') : data.open_id
    const key = `${kind}:${digest(identity).slice(0, 24)}`
    await storage.update(value => {
      value.connections ||= {}
      value.connections[key] = { kind, actorId: pending.actorId, advertiserIds, openId: kind === 'account' ? data.open_id : null,
        accessToken: data.access_token, refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : null,
        scope: data.scope || [], connectedAt: new Date(now()).toISOString(),
        expiresAt: Number(data.expires_in) > 0 ? new Date(now() + Number(data.expires_in) * 1000).toISOString() : null,
      }
    })
    await audit({ actorId: pending.actorId, action: 'tiktok.oauth.connected', targetType: 'tiktok_connection', targetId: key, metadata: { kind, advertiserCount: advertiserIds.length } })
    return { connected: true, kind }
  }
  async function status() {
    const value = await storage.read()
    return { configured: Boolean(env.TIKTOK_BUSINESS_APP_ID && env.TIKTOK_BUSINESS_APP_SECRET), registration,
      connections: Object.entries(value.connections || {}).map(([id, item]) => ({ id, kind: item.kind, advertiserIds: item.advertiserIds, connectedAt: item.connectedAt, expiresAt: item.expiresAt })) }
  }
  function register(app, requireAdmin) {
    app.get('/oauth/tiktok/registration', (_req, res) => res.set('Cache-Control', 'no-store').json({ data: registration }))
    for (const kind of kinds) {
      app.get(`/oauth/tiktok/${kind}/auth-url`, requireAdmin, async (req, res, next) => {
        try { res.set('Cache-Control', 'no-store').json({ data: await begin(kind, req.adminUser.id) }) } catch (error) { next(error) }
      })
      app.get(`/oauth/tiktok/${kind}/callback`, async (req, res) => {
        res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'" })
        if (!Object.keys(req.query).length) return res.type('html').send(page('이 주소는 TikTok에 등록하는 인증 완료 주소입니다. 연결은 CreatorOps 관리자의 인증 요청으로 시작해야 합니다.'))
        try { await complete(kind, req.query); res.type('html').send(page('계정 인증 정보를 안전하게 저장했습니다. 승인된 권한 범위 안에서 사용할 수 있습니다.')) }
        catch (error) { res.status(Number(error.status) || 503).type('html').send(page('연결을 완료하지 못했습니다. CreatorOps 관리자에서 새 연결 요청을 시작하세요.')) }
      })
    }
    app.get('/admin/tiktok-business/status', requireAdmin, async (_req, res, next) => {
      try { res.set('Cache-Control', 'no-store').json({ data: await status() }) } catch (error) { next(error) }
    })
  }
  return { register, registration, begin, complete, status }
}
