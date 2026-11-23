import { useState } from 'react'
import { CONTACT_LANGUAGES, CONTACT_VARIABLES, CONTACT_TEMPLATE_PRESETS, contactPresetId, contactTemplatesForPreset, defaultContactTemplate, validateContactTemplates } from '../shared/campaignContact.js'
import './campaignCommercial.css'

export default function CampaignContactPanel({ campaign, creators, onSave, onPrepare, preview, messageType, messageTypes, onMessageTypeChange }) {
  const [language, setLanguage] = useState(campaign?.outputLanguage || 'ko')
  const [channel, setChannel] = useState('email')
  const [preset, setPreset] = useState(contactPresetId(campaign?.contactTemplatePreset))
  const [libraries, setLibraries] = useState({ ...campaign?.contactTemplateLibrary, [contactPresetId(campaign?.contactTemplatePreset)]: contactTemplatesForPreset(campaign) })
  const [creatorId, setCreatorId] = useState(String(creators[0]?.id || ''))
  const [notice, setNotice] = useState('')
  if (!campaign) return <section className="campaign-commercial"><p>메시지를 작성할 캠페인을 선택해 주세요.</p></section>
  const key = `${channel}:${language}`
  const templates = libraries[preset] || {}
  const template = templates[key] || defaultContactTemplate(language, channel, preset)
  const patchValue = { contactTemplatePreset: preset, contactTemplates: { ...templates, [key]: template }, contactTemplateLibrary: { ...libraries, [preset]: { ...templates, [key]: template } } }
  const creator = creators.find(c => String(c.id) === creatorId) || creators[0]
  const patch = (field, value) => { setLibraries(current => ({ ...current, [preset]: { ...current[preset], [key]: { ...template, [field]: value } } })); setNotice('변경사항을 저장해 주세요.') }
  let error = ''
  let rendered = null
  try {
    validateContactTemplates({ ...templates, [key]: template })
    if (creator) rendered = preview(creator, { ...campaign, ...patchValue }, language, channel)
  } catch (e) { error = e.message }
  return <section className="campaign-commercial" aria-label="캠페인 컨택 메시지 양식">
    <header><div><h3>캠페인 컨택 메시지</h3><p>제공해주신 DM·이메일 양식의 소개 → 협업 내용 → 일정 → 회신 요청 구조를 반영했습니다. 후보별 이름·제품·조건이 자동으로 바뀝니다.</p></div></header>
    <div className="commercial-fields">
      <label>발송 멘트<select aria-label="발송 멘트" value={preset} onChange={e => { setPreset(e.target.value); setNotice('선택한 멘트를 미리보기에서 확인하고 저장 또는 초안 생성을 눌러주세요.') }}>{CONTACT_TEMPLATE_PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
      <label>제안 유형<select aria-label="제안 유형" value={messageType} onChange={e => onMessageTypeChange(e.target.value)}>{messageTypes.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}</select></label>
      <label>채널<select aria-label="채널" value={channel} onChange={e => setChannel(e.target.value)}><option value="email">이메일</option><option value="dm">DM</option></select></label>
      <label>양식 언어<select aria-label="양식 언어" value={language} onChange={e => setLanguage(e.target.value)}>{CONTACT_LANGUAGES.map(value => <option key={value} value={value}>{{ ko: '한국어', en: '영어', ja: '일본어', 'zh-CN': '중국어' }[value]}</option>)}</select></label>
      <label>미리보기 후보<select aria-label="미리보기 후보" value={creator?.id || ''} onChange={e => setCreatorId(e.target.value)}>{creators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    </div>
    <div className="contact-composer"><div><label>제목 양식<input readOnly={!onSave} value={template.subject} maxLength="300" onChange={e => patch('subject', e.target.value)} /></label><label>본문 양식<textarea readOnly={!onSave} value={template.body} maxLength="6000" onChange={e => patch('body', e.target.value)} /></label><small>자동 치환: {CONTACT_VARIABLES.map(v => `{{${v}}}`).join(' · ')}</small></div>
      <div className="contact-preview"><h4>후보별 미리보기</h4>{rendered ? <><strong>{rendered.subject}</strong><pre>{rendered.body}</pre></> : <p>배정 후보가 있으면 실제 발송 초안이 표시됩니다.</p>}</div></div>
    <p>실제 후보별 발송 언어는 캠페인의 국가·언어 설정을 따릅니다. 해외 발송에는 한국어 참고본을 포함하지 않습니다.</p>
    {error && <p role="alert">{error}</p>}
    <footer>{onSave && <button type="button" disabled={Boolean(error)} className="secondary-button compact-button" onClick={() => { onSave(patchValue); setNotice('메시지 양식을 저장했습니다.') }}>메시지 양식 저장</button>}
      {onPrepare && <button type="button" disabled={Boolean(error) || !creators.length} className="primary-button compact-button" onClick={() => { onPrepare(patchValue, channel); setNotice('후보별 초안을 검토함에 준비했습니다. 발송 전 내용을 확인해 주세요.') }}>배정 후보 {creators.length}명 초안 만들기</button>}<span role="status">{notice}</span></footer>
  </section>
}
