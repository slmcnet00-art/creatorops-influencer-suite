import { useState } from 'react'
import { buildCampaignQuote, campaignQuoteSheets } from '../shared/campaignQuote.js'
import { buildReportXlsx } from './reportWorkbook.js'
import './campaignCommercial.css'

const money = value => value == null ? '확인 필요' : `${value.toLocaleString('ko-KR')}원`
export default function CampaignQuotePanel({ campaign, brand, creators, onSave }) {
  const [settings, setSettings] = useState(campaign.quoteSettings || {})
  const [notice, setNotice] = useState('')
  const quote = buildCampaignQuote(campaign, creators, settings)
  const allRows = buildCampaignQuote(campaign, creators, { ...settings, creatorOverrides: {} }).items
  const field = (key, value) => { setSettings(current => ({ ...current, [key]: value })); setNotice('변경사항을 저장해 주세요.') }
  const override = (id, key, value) => setSettings(current => ({ ...current, creatorOverrides: { ...current.creatorOverrides, [id]: { ...current.creatorOverrides?.[id], [key]: value } } }))
  const download = async () => {
    try {
      const bytes = await buildReportXlsx(campaignQuoteSheets(campaign, brand, quote, settings))
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${campaign.name.replace(/[<>:"/\\|?*]/g, '_')}_견적서.xlsx`; anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice('현재 견적 초안을 다운로드했습니다.')
    } catch { setNotice('견적서 다운로드에 실패했습니다. 다시 시도해 주세요.') }
  }
  return <section className="campaign-commercial" aria-label="캠페인 자동 견적서">
    <header><div><h3>캠페인 견적서</h3><p>배정 후보와 단가를 자동 반영합니다. 수량·단가·운영비를 조정해 견적 초안을 만드세요.</p></div><button type="button" className="secondary-button compact-button" onClick={download}>견적서 Excel 다운로드</button></header>
    <div className="commercial-fields">
      <label>발행처<input readOnly={!onSave} value={settings.issuerName ?? '㈜미핑기획'} onChange={e => field('issuerName', e.target.value)} /></label>
      <label>수신처<input readOnly={!onSave} value={settings.recipient ?? brand?.name ?? campaign.brandName ?? ''} onChange={e => field('recipient', e.target.value)} /></label>
      <label>견적 유효기간<input readOnly={!onSave} type="date" value={settings.validUntil || ''} onChange={e => field('validUntil', e.target.value)} /></label>
    </div>
    <p>제품: {campaign.product || '확인 필요'} · 형식: {(campaign.contentFormats || []).join(' + ') || '협의'} · 통화: KRW</p>
    <div className="commercial-table-wrap"><table><thead><tr><th>포함</th><th>크리에이터 / 채널</th><th>수량</th><th>단가 (KRW)</th><th>금액 (KRW)</th><th>근거</th></tr></thead><tbody>{allRows.map(row => {
      const custom = settings.creatorOverrides?.[row.id] || {}
      const current = quote.items.find(item => item.id === row.id)
      return <tr key={row.id}><td><input aria-label={`${row.name} 견적 포함`} type="checkbox" disabled={!onSave} checked={custom.included !== false} onChange={e => override(row.id, 'included', e.target.checked)} /></td><td>{row.name}<small>{row.platform}</small></td>
        <td><input aria-label={`${row.name} 견적 수량`} type="number" min="0" step="1" readOnly={!onSave} value={custom.quantity ?? row.quantity} onChange={e => override(row.id, 'quantity', e.target.value)} /></td>
        <td><input aria-label={`${row.name} 견적 단가`} type="number" min="0" readOnly={!onSave} value={custom.unitPrice ?? row.unitPrice ?? ''} placeholder="확인 필요" onChange={e => override(row.id, 'unitPrice', e.target.value)} /></td>
        <td>{current ? money(current.total) : '제외'}</td><td>{current?.priceLabel || row.priceLabel}</td></tr>
    })}</tbody></table></div>
    {!allRows.length && <p>후보 그룹에서 캠페인에 후보를 배정하면 견적 항목이 자동으로 채워집니다.</p>}
    <div className="commercial-fields">
      <label>운영 기획·관리비 (%)<input aria-label="운영 관리비 비율" readOnly={!onSave} type="number" min="0" max="100" value={settings.managementRate ?? 0} onChange={e => field('managementRate', e.target.value)} /></label>
      <label>배송 단가 (KRW)<input readOnly={!onSave} type="number" min="0" value={settings.shippingUnitCost ?? ''} placeholder="미포함" onChange={e => field('shippingUnitCost', e.target.value)} /></label>
      <label>배송 수량<input readOnly={!onSave} type="number" min="0" step="1" value={settings.shippingQuantity ?? quote.items.length} onChange={e => field('shippingQuantity', e.target.value)} /></label>
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
