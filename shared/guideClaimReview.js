// Generated scripts are proposals: product capabilities and negotiated terms require verification.
export function reviewGuideClaims(value) {
  if (typeof value !== 'string') return value
  return value.split('\n').map(raw => {
    const line = raw
      .replace(/本キャンペーンは現時点で無償シーディング/g, '本キャンペーンの報酬・協業条件は未確定です（要確認）')
      .replace(/合意済み納品物/g, '合意前の納品案（要確認）')
      .replace(/무상 협찬 위주/g, '보상·협업 조건 협의 필요')
    if (/확인 필요|미확인|확인 후|확인 전|未確認|要確認|確認後|事前確認|確認必須|確認必要|confirmation required/i.test(line)) return line
    const jp = /日本語対応|日本語レシピ|レシピ検索|(?:アプリ|機能).*(?:検索|管理|保存|録画|便利|レシピ|使いやす)/.test(line)
    const ko = /일본어.*지원|재료별.*검색|레시피 검색|앱.*(?:기능|검색|관리|저장|찾|확인|화면|레시피)|실패 걱정 없/.test(line)
    const en = /(?:app|application).*(?:supports? Japanese|search|save recipes|manage recipes)/i.test(line)
    if (jp) return `【要確認：機能確認後のみ使用する撮影・台詞案】 ${line}`
    if (ko) return `[확인 필요: 실제 기능 확인 후 사용할 촬영·대사안] ${line}`
    if (en) return `[Confirmation required: use this proposed scene or dialogue only after verifying the feature] ${line}`
    return line
  }).join('\n')
}

export function reviewCampaignGuides(campaign) {
  return {
    ...campaign,
    influencerStrategy: reviewGuideClaims(campaign.influencerStrategy),
    generatedContentGuide: reviewGuideClaims(campaign.generatedContentGuide),
    individualContentGuides: Object.fromEntries(Object.entries(campaign.individualContentGuides || {}).map(([id, entry]) => [id, { ...entry, guide: reviewGuideClaims(entry.guide) }])),
  }
}
