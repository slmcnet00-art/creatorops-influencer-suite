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

export function guideEvidenceAppendix(references = [], language = 'ko') {
  if (language === 'ja') {
    if (!references.length) return '\n\n## 参考コンテンツ\n検証済みの参考資料はありません。原本を確認してから撮影案を確定してください。\n'
    return '\n\n## 参考コンテンツと応用方法\n公開再生数は広告のインストール成果を証明しません。原本を確認し、導入と情報の順序だけを参考にしてください。映像・台詞・音源のコピーは禁止です。\n'
      + references.map((ref, index) => `${index + 1}. ${ref.title || '参考動画'}\n原本: ${ref.url}\n公開再生数: ${Number(ref.views) > 0 ? `${Number(ref.views).toLocaleString('ja-JP')}回` : '動画別の実績は未検証'}\n応用案: ${ref.applyIdea || '原本確認後、問いかけ→実演→完成→CTAの順序を本企画に合わせて変更する'}\n広告コンバージョン: 別途検証が必要`).join('\n\n')
  }
  if (!references.length) return '\n\n## 참고 콘텐츠 근거\n검증된 레퍼런스가 없습니다. 레퍼런스 화면에서 검색·저장한 후 가이드를 다시 생성하세요.\n'
  return '\n\n## 참고 콘텐츠 근거 및 적용 방법\n공개 조회 성과는 광고 전환 성공을 뜻하지 않습니다. 영상 원본을 검토하고 후킹·정보 배열만 참고하며 화면·문장·음원을 복제하지 않습니다.\n'
    + references.map((ref, index) => `${index + 1}. ${ref.title || '참고 콘텐츠'}\n원본: ${ref.url}\n근거: ${ref.source || '저장한 레퍼런스'}${Number(ref.views) > 0 ? ` · 공개 조회수 ${Number(ref.views).toLocaleString('ko-KR')}회` : ' · 영상별 조회 성과 미검증'}${ref.checkedAt || ref.collectedAt ? ` · 수집 시각 ${ref.checkedAt || ref.collectedAt}` : ''}\n적용: ${ref.applyIdea || ref.structure || '원본 확인 후 도입 질문 → 실제 과정 → 결과 → CTA 순서 중 캠페인에 맞는 구조만 변형'}\n광고 전환 성과: 별도 검증 필요`).join('\n\n')
}

export function buildJapaneseIndividualGuide({ campaign, creator, commonGuide }) {
  return `# ${creator.name}様向け 個別制作ガイド\n\nキャンペーン: ${campaign.name}\n媒体: ${creator.platform}\n\n## 担当する撮影\n以下の共通撮影案の各カットを、ご自身の調理・説明スタイルに合わせて撮影してください。冒頭は普段扱う食材の悩みを問いかけ、実際のアプリ画面と調理過程、完成料理の順で示します。台詞は例文であり、実際に確認・体験した内容だけを話してください。\n\n参考原本: ${creator.matchedContentUrl || '担当者と確認'}\nタイトル: ${creator.sourceTitle || '原本確認が必要'}\n\n## 撮影前の確認\nアプリの日本語対応、使える機能、掲載レシピ、入手先URL、報酬、納期は担当者と確認してください。未発行のリンクやクーポンは掲載しないでください。広告表記と公開前承認が必要です。\n\n## 実行する共通撮影案・台詞・参考コンテンツ\n${commonGuide}\n`
}
