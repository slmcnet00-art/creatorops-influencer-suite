export function resolveGuideChannel(campaign = {}) {
  if (campaign.guideChannel && campaign.guideChannel !== 'Instagram Reels') return campaign.guideChannel
  const platforms = String(campaign.preferredPlatforms || '').toLowerCase()
  if (platforms.includes('youtube') && !/instagram|tiktok/.test(platforms)) {
    const formats = campaign.contentFormats ?? []
    return formats.includes('롱폼') && formats.includes('숏폼') ? 'YouTube Shorts + YouTube Longform'
      : formats.includes('롱폼') ? 'YouTube Longform' : 'YouTube Shorts'
  }
  return campaign.guideChannel || '채널 협의 필요'
}

export function getCampaignGuideReferences(campaign, savedReferences = [], savedIds = [], creators = []) {
  const selected = new Set(savedIds.map(String))
  const assigned = new Set((campaign.creatorIds ?? []).map(String))
  const refs = [
    ...(campaign.guideReferences ?? []),
    ...savedReferences.filter((ref) => String(ref.campaignId) === String(campaign.id) && selected.has(String(ref.id)) && ref.referenceKind !== 'brand'),
    ...creators.filter((creator) => assigned.has(String(creator.id)) && creator.matchedContentUrl && creator.sourceTitle && !creator.isDemo).map((creator) => ({
      title: creator.sourceTitle, url: creator.matchedContentUrl, creator: creator.name,
      source: '공개 검색에서 발견한 요리/콘텐츠 근거 · 성과 미검증',
    })),
  ]
  const seen = new Set()
  return refs.filter((ref) => {
    if (!/^https:\/\//.test(ref.url || '') || seen.has(ref.url)) return false
    seen.add(ref.url)
    return true
  }).slice(0, 6)
}

export function guideEvidenceAppendix(references = []) {
  if (!references.length) return '\n\n## 참고 콘텐츠 근거\n검증된 레퍼런스가 없습니다. 레퍼런스 화면에서 검색·저장한 후 가이드를 다시 생성하세요.\n'
  return '\n\n## 참고 콘텐츠 근거 및 적용 방법\n공개 조회 성과는 광고 전환 성공을 뜻하지 않습니다. 영상 원본을 검토하고 후킹·정보 배열만 참고하며 화면·문장·음원을 복제하지 않습니다.\n'
    + references.map((ref, index) => `${index + 1}. ${ref.title || '참고 콘텐츠'}\n원본: ${ref.url}\n근거: ${ref.source || '저장한 레퍼런스'}${Number(ref.views) > 0 ? ` · 공개 조회수 ${Number(ref.views).toLocaleString('ko-KR')}회` : ' · 영상별 조회 성과 미검증'}${ref.checkedAt || ref.collectedAt ? ` · 수집 시각 ${ref.checkedAt || ref.collectedAt}` : ''}\n적용: ${ref.applyIdea || ref.structure || '원본 확인 후 도입 질문 → 실제 과정 → 결과 → CTA 순서 중 캠페인에 맞는 구조만 변형'}\n광고 전환 성과: 별도 검증 필요`).join('\n\n')
}
