import { DISCOVERY_MARKETS, toggleDiscoveryMarket } from '../shared/discoveryMarkets.js'
import './DiscoveryMarkets.css'

export default function DiscoveryMarkets({ countries, onChange, strictCountry, onStrictChange, disabled, summary }) {
  return <section className="discovery-markets" aria-label="YouTube 국가별 동시 검색">
    <fieldset disabled={disabled}>
      <legend>YouTube 검색 국가 · 최대 6개</legend>
      <div className="discovery-market-options">
        {Object.entries(DISCOVERY_MARKETS).map(([code, market]) => <label key={code}>
          <input type="checkbox" checked={countries.includes(code)} disabled={disabled || (!countries.includes(code) && countries.length >= 6)} onChange={() => onChange(toggleDiscoveryMarket(countries, code))} />
          {market.label} ({code})
        </label>)}
      </div>
      <label className="discovery-country-verification"><input type="checkbox" checked={strictCountry} onChange={event => onStrictChange(event.target.checked)} />채널 공개 국가가 확인된 후보만 표시</label>
    </fieldset>
    <p>한국어로 입력해도 국가별 언어로 자동 번역합니다. 요청한 총 인원을 국가별로 균등 배분하며, 관련 근거가 부족하면 적게 반환합니다. 번역은 AI를 사용하며 LLM Ops에 기록됩니다.</p>
    <p>채널의 공개 국가는 시청자 국가를 보장하지 않습니다. 중국·대만 등은 언어가 같아도 별도로 검색합니다.</p>
    {summary && <div className="discovery-market-results" role="status" aria-live="polite">
      <strong>{summary.error ? '검색을 완료하지 못했습니다.' : `국가별 검색 결과 · 중복 제외 ${summary.returned}명`}</strong>
      {summary.error ? <p>{summary.error}</p> : <>
        <p>원문: {summary.originalQuery}</p>
        <ul>{summary.markets?.map(market => <li key={market.country}>
          <strong>{DISCOVERY_MARKETS[market.country]?.label || market.country}</strong>
          <span>{market.query}</span>
          <span>{market.status === 'failed' ? market.error : `${market.returned}/${market.requested}명 · ${market.search?.stale ? '할당량 오류 · 이전 캐시' : market.search?.cacheHit ? '캐시 재사용' : '검색 완료'}${market.partial && market.returned < market.requested ? ' · 조건 충족 후보 부족' : ''}`}</span>
        </li>)}</ul>
        <p>번역된 검색어와 채널·영상의 실제 텍스트 일치를 확인합니다. 이 결과는 협업 적합성이나 정확도 백분율을 보장하지 않습니다.</p>
      </>}
    </div>}
  </section>
}
