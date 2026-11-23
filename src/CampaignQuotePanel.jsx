import { useState } from 'react'
import { buildCampaignQuote, buildQuoteForForm, generalQuoteRows, QUOTE_FORM_TYPES, quoteFormType } from '../shared/campaignQuote.js'
import { buildMipingQuoteXlsx } from './mipingQuoteWorkbook.js'
import './campaignCommercial.css'

const money = value => value == null ? '확인 필요' : `${value.toLocaleString('ko-KR')}원`
export default function CampaignQuotePanel({ campaign, brand, creators, onSave }) {
  const [settings, setSettings] = useState(campaign.quoteSettings || {})
  const [notice, setNotice] = useState('')
  const [downloading, setDownloading] = useState(false)
  const formType = quoteFormType(settings.formType)
  const quote = buildQuoteForForm(campaign, creators, settings)
  const allRows = buildCampaignQuote(campaign, creators, { ...settings, creatorOverrides: {} }).items
  const gradeRows = generalQuoteRows(campaign, creators, settings)
  const field = (key, value) => { setSettings(current => ({ ...current, [key]: value })); setNotice('변경사항을 저장해 주세요.') }
  const override = (id, key, value) => setSettings(current => ({ ...current, creatorOverrides: { ...current.creatorOverrides, [id]: { ...current.creatorOverrides?.[id], [key]: value } } }))
  const changeGrade = (index, key, value) => { setSettings(current => ({ ...current, gradeRows: gradeRows.map((row, i) => i === index ? { ...row, [key]: value } : row) })); setNotice('등급별 계획을 변경했습니다. 저장해 주세요.') }
  const download = async () => {
    setDownloading(true)
    try {
      const response = await fetch(`/templates/miping-${formType}-quote.xlsx`)
      if (!response.ok) throw new Error('양식 다운로드 실패')
      const bytes = await buildMipingQuoteXlsx({ campaign, brand, quote, settings, templateBytes: await response.arrayBuffer() })
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const formLabel = QUOTE_FORM_TYPES.find(type => type.id === formType).label
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${campaign.name.replace(/[<>:"/\\|?*]/g, '_')}_${formLabel.replaceAll(' ', '')}.xlsx`; anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice(`미핑기획 ${formLabel} 양식으로 다운로드했습니다.`)
    } catch { setNotice('견적서 양식을 불러오거나 다운로드하지 못했습니다. 다시 시도해 주세요.') }
    finally { setDownloading(false) }
  }
  return <section className="campaign-commercial" aria-label="캠페인 자동 견적서">
    <header><div><h3>캠페인 견적서</h3><p>미핑기획 양식으로 작성합니다. 등급별 일반 견적서와 크리에이터별 리스트 견적서를 선택하세요.</p></div><button type="button" disabled={downloading} className="secondary-button compact-button" onClick={download}>{downloading ? '견적서 준비 중…' : '견적서 Excel 다운로드'}</button></header>
    <label className="quote-form-picker">견적서 양식<select aria-label="견적서 양식" value={formType} onChange={e => field('formType', e.target.value)}>{QUOTE_FORM_TYPES.map(type => <option key={type.id} value={type.id}>{type.label}{type.id === 'general' ? ' (등급별)' : ' (크리에이터별)'}</option>)}</select><small>{QUOTE_FORM_TYPES.find(type => type.id === formType).description}</small></label>
    <div className="commercial-fields">
      <label>발행처<input readOnly={!onSave} value={settings.issuerName ?? '㈜미핑기획'} onChange={e => field('issuerName', e.target.value)} /></label>
      <label>수신처<input readOnly={!onSave} value={settings.recipient ?? brand?.name ?? campaign.brandName ?? ''} onChange={e => field('recipient', e.target.value)} /></label>
      <label>견적 유효기간<input readOnly={!onSave} type="date" value={settings.validUntil || ''} onChange={e => field('validUntil', e.target.value)} /></label>
      <label>발행처 주소·연락처<input readOnly={!onSave} maxLength="200" value={settings.issuerAddress || ''} onChange={e => field('issuerAddress', e.target.value)} placeholder="견적서 상단에 표시할 회사 정보" /></label>
      <label>견적 작성일<input readOnly={!onSave} type="date" value={settings.issuedAt || ''} onChange={e => field('issuedAt', e.target.value)} /><small>미입력 시 다운로드한 한국 날짜를 사용합니다.</small></label>
    </div>
    <p>제품: {campaign.product || '확인 필요'} · 형식: {(campaign.contentFormats || []).join(' + ') || '협의'} · 통화: KRW</p>
    {formType === 'general' ? <>
      <div className="campaign-tab-actions">{onSave && <><button type="button" className="secondary-button compact-button" onClick={() => { setSettings(current => ({ ...current, gradeRows: [...gradeRows, { id: `grade-${Date.now()}-${gradeRows.length}`, grade: '', name: '인플루언서 콘텐츠 협업', platform: '', scope: (campaign.contentFormats || []).join(' + '), quantity: '', unitPrice: '', note: '' }] })); setNotice('등급·수량·단가를 입력하고 저장해 주세요.') }}>등급 행 추가</button><button type="button" className="secondary-button compact-button" onClick={() => { setSettings(current => { const next = { ...current }; delete next.gradeRows; return next }); setNotice('현재 배정 후보의 등급·단가를 다시 불러왔습니다.') }}>배정 후보 기준 불러오기</button></>}</div>
      <div className="commercial-table-wrap"><table className="grade-quote-table"><thead><tr><th>등급</th><th>채널 / 콘텐츠 형식</th><th>수량</th><th>단가 (KRW)</th><th>금액 (KRW)</th><th>비고</th><th>관리</th></tr></thead><tbody>{gradeRows.map((row, index) => <tr key={row.id}>
        <td><input aria-label={`등급 ${index + 1}`} readOnly={!onSave} value={settings.gradeRows?.[index]?.grade ?? row.grade} onChange={e => changeGrade(index, 'grade', e.target.value)} placeholder="나노 / 마이크로 / 미드 / 매크로 / 메가" /></td>
        <td><input aria-label={`등급 채널 ${index + 1}`} readOnly={!onSave} value={row.platform} onChange={e => changeGrade(index, 'platform', e.target.value)} placeholder="Instagram / TikTok" /><input aria-label={`등급 형식 ${index + 1}`} readOnly={!onSave} value={row.scope} onChange={e => changeGrade(index, 'scope', e.target.value)} /></td>
        <td><input aria-label={`등급 수량 ${index + 1}`} type="number" min="0" step="1" readOnly={!onSave} value={row.quantity ?? ''} onChange={e => changeGrade(index, 'quantity', e.target.value)} /></td>
        <td><input aria-label={`등급 단가 ${index + 1}`} type="number" min="0" readOnly={!onSave} value={row.unitPrice ?? ''} onChange={e => changeGrade(index, 'unitPrice', e.target.value)} placeholder="확인 필요" /></td>
        <td>{money(row.total)}</td><td><input aria-label={`등급 비고 ${index + 1}`} readOnly={!onSave} value={row.note || ''} maxLength="300" onChange={e => changeGrade(index, 'note', e.target.value)} placeholder={row.priceLabel} /></td>
        <td>{onSave && <button type="button" className="secondary-button compact-button" aria-label={`등급 행 ${index + 1} 삭제`} onClick={() => field('gradeRows', gradeRows.filter((_, i) => i !== index))}>삭제</button>}</td>
      </tr>)}</tbody></table></div>
      <p>{settings.gradeRows ? '직접 편집한 등급별 계획 견적입니다. 리스트 견적서의 개별 단가는 변경하지 않습니다.' : '배정 후보의 등급·채널·형식·단가를 기준으로 자동 집계합니다. 단가가 다른 후보는 같은 등급이라도 별도 행으로 표시합니다.'}</p>
      {!gradeRows.length && <p>등급 행을 추가해 수량·단가를 입력하거나 캠페인에 후보를 배정해 주세요.</p>}
    </> : <>
    <div className="commercial-table-wrap"><table><thead><tr><th>포함</th><th>크리에이터 / 채널</th><th>등급</th><th>수량</th><th>단가 (KRW)</th><th>금액 (KRW)</th><th>근거</th></tr></thead><tbody>{allRows.map(row => {
      const custom = settings.creatorOverrides?.[row.id] || {}
      const current = quote.items.find(item => item.id === row.id)
      return <tr key={row.id}><td><input aria-label={`${row.name} 견적 포함`} type="checkbox" disabled={!onSave} checked={custom.included !== false} onChange={e => override(row.id, 'included', e.target.checked)} /></td><td>{row.name}<small>{row.platform}</small></td><td>{row.grade}</td>
        <td><input aria-label={`${row.name} 견적 수량`} type="number" min="0" step="1" readOnly={!onSave} value={custom.quantity ?? row.quantity} onChange={e => override(row.id, 'quantity', e.target.value)} /></td>
        <td><input aria-label={`${row.name} 견적 단가`} type="number" min="0" readOnly={!onSave} value={custom.unitPrice ?? row.unitPrice ?? ''} placeholder="확인 필요" onChange={e => override(row.id, 'unitPrice', e.target.value)} /></td>
        <td>{current ? money(current.total) : '제외'}</td><td>{current?.priceLabel || row.priceLabel}</td></tr>
    })}</tbody></table></div>
    {!allRows.length && <p>후보 그룹에서 캠페인에 후보를 배정하면 견적 항목이 자동으로 채워집니다.</p>}
    </>}
    <div className="commercial-fields">
      <label>운영 기획·관리비 (%)<input aria-label="운영 관리비 비율" readOnly={!onSave} type="number" min="0" max="100" value={settings.managementRate ?? 0} onChange={e => field('managementRate', e.target.value)} /></label>
      <label>배송 단가 (KRW)<input readOnly={!onSave} type="number" min="0" value={settings.shippingUnitCost ?? ''} placeholder="미포함" onChange={e => field('shippingUnitCost', e.target.value)} /></label>
      <label>배송 수량<input readOnly={!onSave} type="number" min="0" step="1" value={settings.shippingQuantity ?? quote.shippingQuantity} onChange={e => field('shippingQuantity', e.target.value)} /></label>
      <label>기타 비용 (KRW)<input readOnly={!onSave} type="number" min="0" value={settings.additionalCost ?? ''} placeholder="미포함" onChange={e => field('additionalCost', e.target.value)} /></label>
      <label>기타 비용 설명<input readOnly={!onSave} maxLength="300" value={settings.additionalNote || ''} onChange={e => field('additionalNote', e.target.value)} placeholder="제품비, 2차 활용료 등" /></label>
      <label>부가세 (%)<input readOnly={!onSave} type="number" min="0" max="100" value={settings.vatRate ?? 10} onChange={e => field('vatRate', e.target.value)} /></label>
    </div>
    <dl className="commercial-totals"><div><dt>공급가액</dt><dd>{money(quote.subtotal)}</dd></div><div><dt>부가세</dt><dd>{money(quote.vat)}</dd></div><div><dt>총 견적 초안</dt><dd>{money(quote.total)}</dd></div></dl>
    <p>{quote.note}</p>{quote.unknownCount > 0 && <p role="status">단가·수량 미확인 {quote.unknownCount}건은 합계에서 제외했습니다.</p>}
    {quote.budget != null && <p>캠페인 예산 {money(quote.budget)} · {quote.total > quote.budget ? `예산 초과 ${money(quote.total - quote.budget)}` : `예산 잔액 ${money(quote.budget - quote.total)}`} (부가세 포함 견적 비교)</p>}
    <label>협업 조건·견적 비고<textarea readOnly={!onSave} value={settings.note || ''} maxLength="2000" onChange={e => field('note', e.target.value)} placeholder="촬영·검수·게시 범위, 2차 활용·결제 조건 등을 입력하세요." /></label>
    <footer>{onSave && <button type="button" className="primary-button compact-button" onClick={() => { onSave(settings); setNotice('견적 초안을 저장했습니다.') }}>견적 초안 저장</button>}<span role="status">{notice}</span></footer>
  </section>
}
