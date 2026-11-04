import { getCreatorRateSummary } from '../shared/creatorRates.js'

const won = value => `${value.toLocaleString('ko-KR')}원`
const factor = value => `×${Number(value.toFixed(3))}`
export default function CreatorRateDetails({ creator, campaign }) {
  const rate = getCreatorRateSummary(creator, campaign)
  return <details className="creator-rate-details">
    <summary>단가 계산 근거</summary>
    <p>{rate.actualPrice ? `협의 금액 ${won(rate.actualPrice)} 우선 적용. 납품 형식·수량·사용권이 이번 캠페인과 같은지 확인하세요.` : rate.estimatedPrice ? `예상 범위 ${won(rate.range.low)} ~ ${won(rate.range.high)} · 예산에는 상한 ${won(rate.budgetPrice)} 반영` : '평균 조회수와 콘텐츠 형식을 확인하면 단가를 계산합니다.'}</p>
    <p>선택 형식마다 1건씩 합산합니다. 범위는 협의용 가정이며 통계적 신뢰구간이 아닙니다.</p>
    <dl>
      <dt>평균 조회수</dt><dd>{rate.factors.averageViews.toLocaleString('ko-KR')}회 · 형식별 지표 우선</dd>
      <dt>플랫폼 기본 단가</dt><dd>조회 1,000회당 {won(rate.factors.baseCpm)}</dd>
      <dt>팔로워·구독자</dt><dd>{rate.factors.followers.toLocaleString('ko-KR')}명 · {factor(rate.factors.followerMultiplier)}</dd>
      <dt>참여율</dt><dd>{rate.factors.engagementBasis === 'unverified' ? '산정 기준 미확인 · 보정 없음' : `${rate.factors.engagement}% · ${rate.factors.engagementBasis === 'views' ? '조회수' : '팔로워'} 대비 · ${factor(rate.factors.engagementMultiplier)}`}</dd>
      <dt>크리에이터 국가</dt><dd>{rate.factors.country} · {factor(rate.factors.countryMultiplier)} · 등록값 기준, 오디언스 국가 아님</dd>
    </dl>
    <ul>{rate.breakdown.map(row => <li key={row.format}>{row.format} 1건 · {row.averageViews.toLocaleString('ko-KR')}회({row.viewsSource}) · {factor(row.formatMultiplier)} · {won(row.estimatedPrice)}</li>)}</ul>
    {rate.warnings.length > 0 && <ul>{rate.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}
    <p>{rate.assumptionLabel}. 실제 거래 데이터로 학습한 모델이 아닙니다. 국가·기본 단가·보정 계수는 시장 시세 확정값이 아닙니다. 세금·제작 추가비·사용권·독점·대행 수수료는 별도 협의합니다.</p>
    <p>방법 참고: <a href="https://www.modash.io/youtube-influencer-pricing-calculator" target="_blank" rel="noreferrer">Modash 계산 방법</a> · <a href="https://www.shopify.com/blog/influencer-pricing" target="_blank" rel="noreferrer">Shopify 가격 산정 안내</a></p>
  </details>
}
