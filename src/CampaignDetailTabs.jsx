import './campaignDetailTabs.css'
const CAMPAIGN_DETAIL_TABS = [
  { id: 'overview', label: '개요·설정', help: '제품, 예산, 목표와 일정을 확인하고 캠페인 입력값을 수정합니다.' },
  { id: 'strategy', label: '전략·가이드', help: '캠페인 전략부터 공통·개별 촬영 가이드까지 생성하고 다운로드합니다.' },
  { id: 'creators', label: '후보·섭외', help: '배정 후보와 섭외 완료 인원을 구분해 확인합니다.' },
  { id: 'quote', label: '견적서', help: '배정 후보 기준 견적을 작성하고 Excel로 다운로드합니다.' },
  { id: 'tracking', label: '링크·추적', help: '개인별 UTM·숏링크를 관리하고 캠페인 리포트로 이동합니다.' },
  { id: 'operations', label: '배송·정산', help: '제품 배송과 실제 지급·정산 기록을 관리합니다.' },
]
export function CampaignDetailTabs({ value, onChange }) {
  const move = event => {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End']
    if (!keys.includes(event.key)) return
    event.preventDefault()
    const index = CAMPAIGN_DETAIL_TABS.findIndex(tab => tab.id === value)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? CAMPAIGN_DETAIL_TABS.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + CAMPAIGN_DETAIL_TABS.length) % CAMPAIGN_DETAIL_TABS.length
    onChange(CAMPAIGN_DETAIL_TABS[next].id)
    event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next].focus()
  }
  return <nav className="campaign-detail-tabs" role="tablist" aria-label="캠페인 상세 탭">{CAMPAIGN_DETAIL_TABS.map(tab => <button id={`campaign-tab-${tab.id}`} key={tab.id} role="tab" type="button" aria-selected={value === tab.id} aria-controls={`campaign-panel-${tab.id}`} tabIndex={value === tab.id ? 0 : -1} onKeyDown={move} onClick={() => onChange(tab.id)}>{tab.label}</button>)}</nav>
}
export function CampaignDetailPanel({ id, activeTab, children }) {
  const tab = CAMPAIGN_DETAIL_TABS.find(tab => tab.id === id)
  return <section className="campaign-detail-tab-panel" id={`campaign-panel-${id}`} role="tabpanel" aria-labelledby={`campaign-tab-${id}`} hidden={activeTab !== id} tabIndex={0}><p className="campaign-tab-help">{tab.help}</p>{children}</section>
}
