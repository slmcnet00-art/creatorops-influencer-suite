export function validateTikTokAuthorizationLink(value, kind, expectedRedirect) {
  const url = new URL(value)
  const advertiser = kind === 'advertiser'
  const origin = advertiser ? 'https://business-api.tiktok.com' : 'https://www.tiktok.com'
  const path = advertiser ? '/portal/auth' : '/v2/auth/authorize/'
  if (!['advertiser', 'account'].includes(kind) || url.origin !== origin || url.pathname !== path || url.username || url.password
    || url.searchParams.get('redirect_uri') !== expectedRedirect || !/^[a-f0-9]{64}$/.test(url.searchParams.get('state') || '')) {
    throw Error('TikTok 승인 주소를 확인할 수 없습니다. 새 연결 요청을 시작하세요.')
  }
  return url.toString()
}
