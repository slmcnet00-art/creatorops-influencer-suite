const frontendUrl = process.env.FRONTEND_URL || 'https://creatorops-influencer-suite.onrender.com'
const apiUrl = process.env.API_URL || 'https://creatorops-suite-api.onrender.com'

function classifyResponse(response, text) {
  if (response.ok) return { ok: true, blocked: false }
  const blocked = response.status === 429
    || (response.status === 403 && /quota|rate limit/i.test(text))
  return { ok: false, blocked }
}

async function checkUrl(label, url) {
  const startedAt = Date.now()
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) })
    const text = await response.text()
    const classification = classifyResponse(response, text)
    return {
      label,
      url,
      ...classification,
      status: response.status,
      ms: Date.now() - startedAt,
      sample: text.slice(0, 180).replace(/\s+/g, ' ').trim(),
    }
  } catch (error) {
    return {
      label,
      url,
      ok: false,
      blocked: false,
      status: 'ERROR',
      ms: Date.now() - startedAt,
      sample: error instanceof Error ? error.message : String(error),
    }
  }
}

async function checkReadiness(label, url) {
  const startedAt = Date.now()
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000),
    })
    const text = await response.text()
    const payload = JSON.parse(text)
    const safe = payload?.safety?.readOnly === true
      && payload?.safety?.emailSent === false
      && payload?.safety?.contentGenerated === false
      && payload?.safety?.dataWritten === false
      && payload?.safety?.secretsIncluded === false
    const ready = ['ready', 'ready_with_user_action'].includes(payload?.summary?.state)
    const integrations = Array.isArray(payload?.integrations) ? payload.integrations : []
    const needsActionItems = integrations
      .filter((item) => !['ready', 'authorization_required'].includes(item.state))
    const blocked = needsActionItems.length > 0
      && needsActionItems.every((item) => item.state === 'rate_limited')
    const needsAction = needsActionItems
      .map((item) => `${item.key}:${item.state}`)
    return {
      label,
      url,
      ok: response.ok && payload?.ok === true && safe && ready,
      blocked,
      status: response.status,
      ms: Date.now() - startedAt,
      sample: safe
        ? `state=${payload?.summary?.state || 'unknown'} ready=${payload?.summary?.ready || 0}/${payload?.summary?.total || 0}${needsAction.length ? ` needs_action=${needsAction.join(',')}` : ''}`
        : 'Read-only safety contract is missing or invalid.',
    }
  } catch (error) {
    return {
      label,
      url,
      ok: false,
      blocked: false,
      status: 'ERROR',
      ms: Date.now() - startedAt,
      sample: error instanceof Error ? error.message : String(error),
    }
  }
}

const checks = await Promise.all([
  checkUrl('frontend', `${frontendUrl}/?v=production-check-${Date.now()}`),
  checkUrl('api', `${apiUrl}/health`),
  checkReadiness('safe-readiness', `${apiUrl}/readiness?probe=live`),
])
const results = checks
for (const check of results) {
  const resultLabel = check.ok ? 'OK' : check.blocked ? 'BLOCKED' : 'FAIL'
  console.log(`${resultLabel} ${check.label} ${check.status} ${check.ms}ms ${check.url}`)
  console.log(`  ${check.sample}`)
}

const blocked = results.filter((check) => check.blocked)
const failed = results.filter((check) => !check.ok && !check.blocked)

if (blocked.length) {
  console.log('\nExternal blockers:')
  for (const check of blocked) {
    console.log(`- ${check.label}: 외부 API 할당량 또는 호출 제한 상태입니다. 코드 배포 장애와는 별개입니다.`)
  }
}

if (failed.length) {
  console.log('\nNext action:')
  if (failed.some((check) => check.label === 'api')) {
    console.log('- Render에서 creatorops-suite-api 서비스와 최근 배포 로그를 확인하세요.')
  }
  if (failed.some((check) => check.label === 'safe-readiness')) {
    console.log('- /readiness 결과의 needs_action 상태를 확인하세요. 이 검사는 데이터 쓰기, AI 생성, 메일 발송을 하지 않습니다.')
  }
  process.exitCode = 1
}
