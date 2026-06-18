const frontendUrl = process.env.FRONTEND_URL || 'https://creatorops-influencer-suite.onrender.com'
const apiUrl = process.env.API_URL || 'https://creatorops-suite-api.onrender.com'

async function checkUrl(label, url) {
  const startedAt = Date.now()
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) })
    const text = await response.text()
    return {
      label,
      url,
      ok: response.ok,
      status: response.status,
      ms: Date.now() - startedAt,
      sample: text.slice(0, 180).replace(/\s+/g, ' ').trim(),
    }
  } catch (error) {
    return {
      label,
      url,
      ok: false,
      status: 'ERROR',
      ms: Date.now() - startedAt,
      sample: error instanceof Error ? error.message : String(error),
    }
  }
}

const checks = await Promise.all([
  checkUrl('frontend', `${frontendUrl}/?v=production-check-${Date.now()}`),
  checkUrl('api', `${apiUrl}/health`),
])

const endpointChecks = await Promise.all([
  checkPost('youtube-discovery-contract', `${apiUrl}/discovery/youtube/search`, {
    query: 'pet creator',
    maxResults: 1,
  }),
  checkPost('ai-message-contract', `${apiUrl}/ai/outreach-message`, {
    creator: { name: 'test' },
    brand: { brandName: 'test' },
    campaign: { name: 'test' },
  }),
])

for (const check of [...checks, ...endpointChecks]) {
  console.log(`${check.ok ? 'OK' : 'FAIL'} ${check.label} ${check.status} ${check.ms}ms ${check.url}`)
  console.log(`  ${check.sample}`)
}

const failed = [...checks, ...endpointChecks].filter((check) => !check.ok)
if (failed.length) {
  console.log('\nNext action:')
  if (failed.some((check) => check.label === 'api')) {
    console.log('- Render에서 creatorops-api 서비스가 생성/배포됐는지 확인하세요.')
    console.log('- Render Blueprint Sync 또는 New Web Service 생성 후 환경변수 API 키를 입력해야 합니다.')
  }
  process.exitCode = 1
}

async function checkPost(label, url, body) {
  const startedAt = Date.now()
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    })
    const text = await response.text()
    const contractReady = response.status === 501 || response.ok
    return {
      label,
      url,
      ok: contractReady,
      status: response.status,
      ms: Date.now() - startedAt,
      sample: text.slice(0, 180).replace(/\s+/g, ' ').trim(),
    }
  } catch (error) {
    return {
      label,
      url,
      ok: false,
      status: 'ERROR',
      ms: Date.now() - startedAt,
      sample: error instanceof Error ? error.message : String(error),
    }
  }
}
