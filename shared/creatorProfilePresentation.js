export function creatorAudience(creator = {}) {
  const followers = creator.followers
  if (followers != null && followers !== '' && Number(followers) > 0) return { value: Number(followers), label: creator.platform === 'YouTube' ? 'Subscribers' : `${creator.platform || '채널'} 팔로워`, source: creator.followerSource || '채널 기준' }
  if (Number(creator.combinedFollowers) > 0) return { value: Number(creator.combinedFollowers), label: '전체 채널 합산 팔로워', source: '제공 리스트 기준 · 채널별 미분리' }
  return { value: null, label: '팔로워 확인 필요', source: '미수집' }
}
export function creatorProfileImage(creator = {}) {
  const urls = [creator.avatar, creator.thumbnailUrl, ...(creator.socialProfiles || []).map(profile => profile.avatar)]
  return urls.find(url => /^https:\/\//.test(url || '') && !/unsplash\.com|ui-avatars\.com|data:image/i.test(url)) || ''
}
