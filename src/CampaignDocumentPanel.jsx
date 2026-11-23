import { useState } from 'react'
import { documentKind, prepareCampaignDocument } from '../shared/campaignDocuments.js'
import './campaignDocuments.css'

export default function CampaignDocumentPanel({ campaign, kind, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ name: '', url: '', note: '', status: '참고 양식' })
  const [error, setError] = useState('')
  const quote = kind === 'quote'
  const title = quote ? '견적서·협업 조건' : '컨택 양식·제안 자료'
  const documents = (Array.isArray(campaign?.documents) ? campaign.documents : []).filter(doc => doc && documentKind(doc) === kind && /^https:\/\//i.test(doc.url || ''))
  function submit(event) {
    event.preventDefault()
    try {
      const value = prepareCampaignDocument(draft, kind)
      onSave(value)
      setEditing(false)
      setDraft({ name: '', url: '', note: '', status: '참고 양식' })
      setError('')
    } catch (failure) { setError(failure.message) }
  }
  return <section className="campaign-document-panel" aria-label={title}>
    <header><div><h3>{title}</h3><p>{quote ? '예산·단가·협업 범위를 확인하고 양식, 견적 초안, 확정 견적을 구분해 관리합니다.' : '선택 캠페인의 DM·이메일 양식과 제안서를 확인한 뒤 아래 발송 작업에서 사용하세요.'}</p></div>
      {onSave && campaign && <button className="secondary-button compact-button" type="button" onClick={() => { setEditing(!editing); setError('') }}>{editing ? '등록 닫기' : quote ? '견적서 링크 등록' : '컨택 양식 링크 등록'}</button>}
    </header>
    {!campaign ? <p>캠페인을 먼저 선택해 주세요.</p> : !documents.length ? <p className="campaign-document-empty">{quote ? '등록된 견적서가 없습니다.' : '등록된 컨택 양식이 없습니다.'}</p> : <ul>{documents.map(doc => <li key={doc.url}><div><a href={doc.url} target="_blank" rel="noreferrer">{doc.name} ↗</a><small>{doc.note}</small></div><span>{doc.status || '참고 양식'}</span></li>)}</ul>}
    {editing && onSave && <form onSubmit={submit}>
      <label>자료명<input required maxLength="80" value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder={quote ? '예: 캠페인 견적 초안' : '예: 이메일 협업 제안 양식'} /></label>
      <label>자료 링크<input required type="url" value={draft.url} onChange={event => setDraft({ ...draft, url: event.target.value })} placeholder="https://docs.google.com/..." /></label>
      <label>자료 구분<select aria-label="자료 구분" value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value })}>{(quote ? ['참고 양식', '견적 초안', '확정 견적', '협업 조건'] : ['참고 양식', 'DM 양식', '이메일 양식', '협업 제안서']).map(status => <option key={status}>{status}</option>)}</select></label>
      <label>설명<input maxLength="200" value={draft.note} onChange={event => setDraft({ ...draft, note: event.target.value })} placeholder="적용 범위 또는 확인 사항" /></label>
      {error && <p role="alert">{error}</p>}
      <button className="primary-button compact-button" type="submit">자료 링크 저장</button>
    </form>}
  </section>
}
