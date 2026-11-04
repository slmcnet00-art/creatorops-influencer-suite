import { DISCOVERY_MARKETS, toggleDiscoveryMarket } from '../shared/discoveryMarkets.js'
import './DiscoveryMarkets.css'

const languageLabels = { ko:'한국어', en:'영어', ja:'일본어', zh:'중국어 간체', 'zh-TW':'중국어 번체', vi:'베트남어', th:'태국어', id:'인도네시아어', ms:'말레이어', fr:'프랑스어', de:'독일어', es:'스페인어' }

export default function DiscoveryMarkets({ platform = 'YouTube', countries, onChange, strictCountry, onStrictChange, profileStrictCountry, onProfileStrictChange, disabled, summary }) {
  return <section className="discovery-markets" aria-label="국가별 동시 검색">
    <fieldset disabled={disabled}>
      <legend>{platform === '전체' ? '전체 플랫폼' : platform} 검색 국가 · 최대 6개</legend>
      <div className="discovery-market-options">
        {Object.entries(DISCOVERY_MARKETS).map(([code, market]) => <label key={code}>
          <input type="checkbox" checked={countries.includes(code)} disabled={disabled || (!countries.includes(code) && countries.length >= 6)} onChange={() => onChange(toggleDiscoveryMarket(countries, code))} />
          <span>{market.label} ({code})<small aria-hidden="true">{languageLabels[market.language] || market.languageName} 기본</small></span>
        </label>)}
      </div>
      {(platform === 'YouTube' || platform === '전체') && <label className="discovery-country-verification"><input type="checkbox" checked={strictCountry} onChange={event => onStrictChange(event.target.checked)} />YouTube 채널 공개 국가가 확인된 후보만 표시</label>}
      {platform !== 'YouTube' && <label className="discovery-country-verification"><input type="checkbox" checked={profileStrictCountry} onChange={event => onProfileStrictChange(event.target.checked)} />Instagram·TikTok 공개 텍스트에 국가 추정 근거가 있는 후보만 표시</label>}
    </fieldset>
    <p>AI가 국가별 언어와 관련 세부 주제로 검색어를 준비합니다. 후보가 부족하면 국가당 최대 3개 검색어로 실제 검색을 확장합니다. 원래 조건을 유지하고 중복을 제거하며, 조건에 맞는 후보가 부족하면 적게 반환합니다.</p>
    <p>국가 선택은 검색 범위입니다. Instagram·TikTok 계정의 국가는 공개 텍스트로 추정하거나 미확인으로 표시합니다. 시청자 국가·거주지는 별도 확인이 필요합니다.</p>
    {summary && <div className="discovery-market-results" role="status" aria-live="polite">
      <strong>{summary.error ? '검색을 완료하지 못했습니다.' : `국가별 검색 결과 · 중복 제외 ${summary.returned}명`}</strong>
      {summary.error ? <p>{summary.error}</p> : <>
        <p>원문: {summary.originalQuery}</p>
        <ul>{summary.markets?.map(market => <li key={`${market.platform || 'YouTube'}:${market.country}`}>
          <strong>{DISCOVERY_MARKETS[market.country]?.label || market.country}</strong>
          <span>{market.platform && `${market.platform} · `}{market.query}</span>
          <span>{market.status === 'failed' ? market.error : `${market.returned}/${market.requested}명 · ${market.search?.stale ? '할당량 오류 · 이전 캐시' : market.search?.cacheHit ? '캐시 재사용' : '검색 완료'}${market.partial && market.returned < market.requested ? ' · 조건 충족 후보 부족' : ''}`}</span>
          {market.search?.attempts?.length > 0 && <span>실행 검색어 {market.search.attempts.length}개: {market.search.attempts.map(item => `${item.query}${item.status === 'failed' ? ' (실패)' : ''}`).join(' · ')}</span>}
          {market.search?.provider === 'public-search' && <span>국가 추정 {market.countryInferred || 0}명 · 국가 미확인 {market.countryUnverified || 0}명{market.search.platforms?.some(p=>p.status === 'failed') ? ' · 일부 플랫폼 요청 실패' : ''}</span>}
        </li>)}</ul>
        {summary.errors?.map(error => <p key={error}>{error}</p>)}
        <p>번역된 검색어와 프로필·영상의 공개 텍스트 일치를 확인합니다. 이 결과는 협업 적합성이나 정확도 백분율을 보장하지 않습니다.</p>
      </>}
    </div>}
  </section>
}
