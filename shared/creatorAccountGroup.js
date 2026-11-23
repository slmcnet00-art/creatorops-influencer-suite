// BRAND DASH: 01. 미디어_계산 지표 내부 가이드.
// The source repeats 10,000 for nano and micro. Use nano below 10,000,
// micro from 10,000, consistently with the stated upper-group-exclusive rule.
export const ACCOUNT_GROUPS = [
  { id: 'mega', label: '메가', min: 300000, range: '30만 이상' },
  { id: 'macro', label: '매크로', min: 100000, range: '10만 이상 ~ 30만 미만' },
  { id: 'mid', label: '미드', min: 50000, range: '5만 이상 ~ 10만 미만' },
  { id: 'micro', label: '마이크로', min: 10000, range: '1만 이상 ~ 5만 미만' },
  { id: 'nano', label: '나노', min: 0, range: '1만 미만' },
]

export function creatorAccountGroup(creator = {}) {
  const value = creator.followers
  const unavailable = ['missing', 'unavailable', 'restricted', 'unverified'].includes(creator.metric_availability?.followers)
  // Imported legacy zeroes are placeholders unless explicitly measured.
  const followers = value !== '' && value != null && typeof value !== 'boolean' ? Number(value) : NaN
  if (unavailable || !Number.isFinite(followers) || followers < 0 || (followers === 0 && !creator.followersCollectedAt && !creator.followerSource)) {
    return { id: 'unknown', label: '등급 미확인', detail: '채널별 구독자·팔로워 수 확인 필요', followers: null }
  }
  const group = ACCOUNT_GROUPS.find(item => followers >= item.min)
  return { ...group, followers, detail: `${creator.platform === 'YouTube' ? 'Subscribers' : '팔로워'} ${followers.toLocaleString('ko-KR')} · ${group.range} · 데이터 정의 기준` }
}
