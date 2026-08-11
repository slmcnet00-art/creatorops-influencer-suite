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
    const classification = classifyResponse(response, text)
    return {
      label,
      url,
      ok: response.status === 501 || classification.ok,
      blocked: classification.blocked,
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

const checks = await Promise.all([
  checkUrl('frontend', `${frontendUrl}/?v=production-check-${Date.now()}`),
  checkUrl('api', `${apiUrl}/health`),
])

const endpointChecks = await Promise.all([
  checkPost('youtube-discovery-contract', `${apiUrl}/discovery/youtube/search`, {
    query: 'pet creator',
    maxResults: 1,
  }),
  checkPost('ai-recommendation-enrichment-contract', `${apiUrl}/ai/recommendations/enrich`, {
    brand: { name: 'CreatorOps Production Check', product: 'test product' },
    campaign: { name: 'production route check', goal: 'verify AI recommendation enrichment' },
    candidates: [{
      recommendationId: 'rec-production-check',
      creatorId: 'creator-production-check',
      creatorName: 'Production Check Creator',
      platform: 'YouTube',
      category: 'review',
      followers: 120000,
      averageViews: 280000,
      engagement: 5.8,
      score: 92,
      reasons: ['route check candidate'],
    }],
  }),
  checkPost('ai-message-contract', `${apiUrl}/ai/outreach-message`, {
    creator: { name: 'test' },
    brand: { brandName: 'test' },
    campaign: { name: 'test' },
  }),
])

const results = [...checks, ...endpointChecks]
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
  if (failed.some((check) => check.label === 'ai-recommendation-enrichment-contract')) {
    console.log('- 404이면 최신 server/index.js 배포 여부를, 501이면 OPENAI_API_KEY를 확인하세요.')
  }
  process.exitCode = 1
}
