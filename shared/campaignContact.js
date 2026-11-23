export const CONTACT_LANGUAGES = ['ko', 'en', 'ja', 'zh-CN']
export const CONTACT_VARIABLES = ['creatorName', 'brand', 'campaignName', 'product', 'deadline', 'offer', 'replyRequest', 'formats', 'sender']
export function contactProductLabel(campaign = {}, language = 'ko', fallback = '') {
  const product = String(campaign.product || fallback || '').trim()
  if (product && !/확인 필요|미정|미입력|상세 확인/.test(product)) return product
  return { ko: '브랜드 제품', en: 'the brand’s products', ja: 'ブランドの商品', 'zh-CN': '品牌产品' }[language] || 'the brand’s products'
}
const defaults = {
  ko: { subject: '[미핑기획] {{brand}} 콘텐츠 협업 제안 😊', body: '{{creatorName}}님, 안녕하세요! 😊\n{{sender}}입니다.\n브랜드와 크리에이터의 콘텐츠를 연결하는 홍보·마케팅 업무를 진행하고 있어요.\n\n📌 {{brand}}의 {{product}} 협업을 제안드리고 싶어 연락드렸습니다.\n{{offer}}\n\n· 콘텐츠 형식: {{formats}}\n· 일정: {{deadline}}\n\n{{replyRequest}}\n관심 있으시면 이메일 또는 편하신 연락 방법도 함께 알려주세요.\n참여 의사를 확인한 뒤 상세 브리프와 진행 조건을 안내드리겠습니다.\n\n감사합니다!\n{{sender}} 드림' },
  en: { subject: '[Mipingplan] {{brand}} creator collaboration 😊', body: 'Hi {{creatorName}}! 😊\nThis is {{sender}}, a brand marketing team connecting brands with creators.\n\n📌 We would like to discuss a collaboration for {{brand}} and {{product}}.\n{{offer}}\n\n· Content format: {{formats}}\n· Timing: {{deadline}}\n\n{{replyRequest}}\nPlease also share your preferred email or contact method if interested. We will follow up with the detailed brief and terms.\n\nThank you!\n{{sender}}' },
  ja: { subject: '【Mipingplan】{{brand}} コラボレーションのご相談 😊', body: '{{creatorName}}様、こんにちは！😊\nブランドとクリエイターをつなぐマーケティングチーム、{{sender}}です。\n\n📌 {{brand}}の{{product}}について、コラボレーションをご相談したくご連絡しました。\n{{offer}}\n\n・コンテンツ形式：{{formats}}\n・日程：{{deadline}}\n\n{{replyRequest}}\nご興味がございましたら、ご希望のメールアドレスや連絡方法もお知らせください。詳細なブリーフと条件を改めてご案内いたします。\n\nよろしくお願いいたします。\n{{sender}}' },
  'zh-CN': { subject: '【Mipingplan】{{brand}} 内容合作邀请 😊', body: '{{creatorName}}，您好！😊\n我们是连接品牌与创作者的营销团队{{sender}}。\n\n📌 想邀请您了解{{brand}}的{{product}}内容合作。\n{{offer}}\n\n· 内容形式：{{formats}}\n· 时间：{{deadline}}\n\n{{replyRequest}}\n如果感兴趣，也请告知方便联系的邮箱或联系方式。我们会进一步发送详细简报和合作条件。\n\n谢谢！\n{{sender}}' },
}
export function defaultContactTemplate(language = 'ko', channel = 'email') {
  const base = defaults[language] || defaults.en
  if (channel !== 'dm') return { ...base }
  const bodies = {
    ko: '{{creatorName}}님, 안녕하세요! 😊 {{sender}}입니다.\n{{brand}}의 {{product}} 콘텐츠 협업을 제안드려요.\n\n{{offer}}\n형식: {{formats}} · 일정: {{deadline}}\n\n{{replyRequest}}\n관심 있으시면 편하신 이메일이나 연락 방법을 알려주세요. 상세 브리프와 조건을 안내드릴게요. 감사합니다!',
    en: 'Hi {{creatorName}}! 😊 This is {{sender}}.\nWe would like to discuss a {{brand}} collaboration for {{product}}.\n\n{{offer}}\nFormat: {{formats}} · Timing: {{deadline}}\n\n{{replyRequest}}\nIf interested, please share your preferred email or contact method. We will send the detailed brief and terms. Thank you!',
    ja: '{{creatorName}}様、こんにちは！😊 {{sender}}です。\n{{brand}}の{{product}}のコラボレーションをご相談したくご連絡しました。\n\n{{offer}}\n形式：{{formats}}・日程：{{deadline}}\n\n{{replyRequest}}\nご興味がございましたら、ご希望の連絡先をお知らせください。詳細ブリーフと条件をご案内いたします。',
    'zh-CN': '{{creatorName}}，您好！😊 我们是{{sender}}。\n想邀请您了解{{brand}}的{{product}}内容合作。\n\n{{offer}}\n形式：{{formats}} · 时间：{{deadline}}\n\n{{replyRequest}}\n如果感兴趣，请告知方便联系的邮箱或联系方式。我们会发送详细简报和条件。谢谢！',
  }
  return { ...base, body: bodies[language] || bodies.en }
}
export function renderContactTemplate(template, variables = {}) {
  const unknown = [...String(template).matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].map(match => match[1]).filter(key => !CONTACT_VARIABLES.includes(key))
  if (unknown.length) throw new Error(`지원하지 않는 치환 항목: ${[...new Set(unknown)].join(', ')}`)
  return String(template).replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, key) => String(variables[key] ?? ''))
}
export function validateContactTemplates(templates = {}) {
  for (const [key, template] of Object.entries(templates)) {
    if (!/^(email|dm):(ko|en|ja|zh-CN)$/.test(key)) throw new Error(`지원하지 않는 양식: ${key}`)
    if (!template?.subject?.trim() || !template?.body?.trim()) throw new Error(`${key}: 제목과 본문을 입력해 주세요.`)
    renderContactTemplate(template.subject); renderContactTemplate(template.body)
  }
}
export function campaignContactMessage(campaign = {}, language = 'ko', channel = 'email', variables = {}) {
  const key = `${channel}:${language}`
  let template = campaign.contactTemplates?.[key] || defaultContactTemplate(language, channel)
  try { validateContactTemplates({ [key]: template }) } catch { template = defaultContactTemplate(language, channel) }
  const formatLabels = { 숏폼: { en: 'Short video', ja: 'ショート動画', 'zh-CN': '短视频' }, 롱폼: { en: 'Long video', ja: '長尺動画', 'zh-CN': '长视频' }, 라이브: { en: 'Live', ja: 'ライブ', 'zh-CN': '直播' }, '이미지/캐러셀': { en: 'Image / carousel', ja: '画像・カルーセル', 'zh-CN': '图片/轮播' }, 스토리: { en: 'Story', ja: 'ストーリーズ', 'zh-CN': '快拍' } }
  const terms = { ko: '협의 후 확정', en: 'To be agreed', ja: 'ご相談の上決定', 'zh-CN': '协商后确定' }
  const values = { sender: language === 'ko' ? '미핑기획 담당자' : 'Mipingplan', brand: campaign.brandName || '', campaignName: campaign.name || '', product: campaign.product || '',
    deadline: campaign.schedule?.uploadDue || terms[language] || terms.en,
    formats: (campaign.contentFormats || []).map(format => formatLabels[format]?.[language] || format).join(' + ') || terms[language] || terms.en, ...variables }
  values.product = contactProductLabel({ product: values.product }, language)
  return { subject: renderContactTemplate(template.subject, values), body: renderContactTemplate(template.body, values) }
}
