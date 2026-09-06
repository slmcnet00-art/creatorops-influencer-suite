function normalizeId(value) {
  return String(value ?? '')
}

export function getApprovedContentTemplates(templates = [], brandId = '') {
  const normalizedBrandId = normalizeId(brandId)
  return (Array.isArray(templates) ? templates : [])
    .filter((template) => {
      if (template?.status !== 'approved') return false
      if (!normalizedBrandId) return true
      return !template.brandId || normalizeId(template.brandId) === normalizedBrandId
    })
    .sort((left, right) => String(right.updatedAt || right.createdAt || '').localeCompare(String(left.updatedAt || left.createdAt || '')))
}

export function buildReusableTemplateLearningMaterial(template = {}) {
  const analysis = template.structureAnalysis || {}
  const structureParts = [
    template.structure,
    analysis.pattern && `구조 유형: ${analysis.pattern}`,
    analysis.hook && `후킹: ${analysis.hook}`,
    analysis.flow && `전개: ${analysis.flow}`,
    analysis.proof && `근거: ${analysis.proof}`,
    analysis.cta && `CTA: ${analysis.cta}`,
  ].filter(Boolean)

  return {
    id: `approved-template-${template.id || 'unknown'}`,
    title: `승인 위닝 소재 · ${template.name || '이름 없음'}`,
    sourceType: 'approved_content_template',
    sourceName: template.sourceType === 'owned_campaign' ? '우리 캠페인 성과' : '승인 레퍼런스',
    summary: [template.performanceReason, ...structureParts].filter(Boolean).join(' / '),
    keywords: [template.platform, ...(template.scopes || [])].filter(Boolean).join(', '),
    doSay: structureParts.join('\n'),
    dontSay: '원본 문장, 자막, 화면 또는 구도를 그대로 복제하지 말고 성과가 확인된 구조만 캠페인에 맞게 변형합니다.',
    templateId: template.id,
  }
}

export function buildReusableTemplateLearningMaterials(templates = [], brandId = '') {
  return getApprovedContentTemplates(templates, brandId).map(buildReusableTemplateLearningMaterial)
}

export function getYouTubeThumbnailUrl(value = '') {
  try {
    const url = new URL(String(value))
    const hostname = url.hostname.replace(/^www\./, '').toLowerCase()
    let videoId = ''
    if (hostname === 'youtu.be') videoId = url.pathname.split('/').filter(Boolean)[0] || ''
    if (hostname.endsWith('youtube.com')) {
      videoId = url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|embed)\/([^/?#]+)/i)?.[1] || ''
    }
    if (!/^[\w-]{6,}$/.test(videoId)) return ''
    return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
  } catch {
    return ''
  }
}
