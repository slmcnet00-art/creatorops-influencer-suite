import test from 'node:test'
import assert from 'node:assert/strict'
import { inferPublicProfileCountry, isAllowedSocialResult, profileMarketQueries, braveMarketOptions, createProfileSearchPacer, discoverPublicProfiles, isLikelyCreatorProfile } from '../server/profileMarketDiscovery.js'
import { searchAcrossMarkets } from '../server/multiMarketDiscovery.js'

test('공개 검색 국가·언어·핸들만으로 계정 국가를 확정하지 않는다',()=>{
  assert.equal(inferPublicProfileCountry({searchCountry:'JP',name:'japan',handle:'@seoul',profileUrl:'https://instagram.com/korea',sourceTitle:'Beauty Creator',sourceSnippet:'K-beauty tutorials'}).country,'')
  assert.equal(inferPublicProfileCountry({sourceSnippet:'Makeup creator based in Seoul, Korea'}).country,'KR')
  assert.equal(inferPublicProfileCountry({sourceSnippet:'Travel between Japan and California'}).countryEvidenceStatus,'ambiguous-public-text')
  assert.equal(inferPublicProfileCountry({sourceSnippet:'Contact us for collaborations'}).country,'')
})
test('허용한 실제 프로필·틱톡 영상 URL만 후보로 정규화한다',()=>{
  for(const url of ['https://instagram.com/alice/','https://www.instagram.com/alice'])assert.equal(isAllowedSocialResult(url,'Instagram'),true)
  for(const url of ['https://instagram.com.evil.test/alice','https://evilinstagram.com/alice','http://instagram.com/alice','https://instagram.com/p/post','https://instagram.com/explore/','https://instagram.com/reel/abc'])assert.equal(isAllowedSocialResult(url,'Instagram'),false)
  assert.equal(isAllowedSocialResult('https://www.tiktok.com/@alice/video/123','TikTok'),true)
  assert.equal(isAllowedSocialResult('https://www.tiktok.com/tag/beauty','TikTok'),false)
})
test('검색어와 선택 국가를 유지하고 국가별 언어 코드와 공개 검색 한계를 구분한다',()=>{
  assert.match(profileMarketQueries('美容液','Instagram','JP')[0],/美容液 インフルエンサー 日本/)
  assert.ok(profileMarketQueries('serum','TikTok','US').every(q=>!q.includes('한국')))
  assert.deepEqual(braveMarketOptions('JP'),{country:'JP',language:'jp'})
  assert.deepEqual(braveMarketOptions('VN'),{country:'ALL',language:'vi'})
  assert.equal(braveMarketOptions('ID').language,'')
})
const normalize=(item,platform,country)=>({id:platform+item.url,platform,profileUrl:platform==='TikTok'?item.url.split('/video/')[0]:item.url,name:item.title,sourceTitle:item.title,sourceSnippet:item.description,searchCountry:country})
test('공개 프로필 결과는 원문 제품 근거·국가 추정·중복을 검증하고 미확인은 표시한다',async()=>{
  let calls=0
  const items=await discoverPublicProfiles({query:'serum',sourceQuery:'세럼',platform:'Instagram',country:'US',maxResults:3,normalize,request:async()=>{calls++;return[
    {url:'https://instagram.com/alice',title:'Serum reviewer',description:'based in California'},
    {url:'https://instagram.com/alice/',title:'Serum reviewer',description:'based in California'},
    {url:'https://instagram.com/unknown',title:'Serum review'},
    {url:'https://instagram.com/korea',title:'Serum review',description:'Seoul'},
    {url:'https://instagram.com/gaming',title:'Game streaming'},
  ]}})
  assert.equal(calls,2);assert.equal(items.length,2)
  assert.equal(items.find(i=>i.profileUrl.includes('unknown')).countryConfidence,'unverified')
  assert.ok(items.every(i=>i.verifiedMetrics===false));assert.equal(items.some(i=>i.profileUrl.endsWith('/korea')),false)
})
test('국가 추정 근거 필터는 공식 국가 검증으로 승격하지 않는다',async()=>{
  const result=await searchAcrossMarkets({query:'세럼',countries:['US'],maxResults:3,strictCountry:true,countryPolicy:'public-profile',translate:async()=>({US:'serum'}),search:async()=>[
    {id:'a',name:'serum',country:'US',countryConfidence:'detected'},
    {id:'b',name:'serum',country:'',countryConfidence:'unverified'},
    {id:'c',name:'serum',country:'KR',countryConfidence:'detected'},
  ]})
  assert.equal(result.data.length,1);assert.equal(result.data[0].discoveryEvidence.countryVerified,false);assert.equal(result.data[0].discoveryEvidence.countryInferred,true)
})
test('국가 미확인 후보는 검색된 국가 목록을 보존하며 국가 간 한 번만 반환한다',async()=>{
  const result=await searchAcrossMarkets({query:'serum',countries:['US','GB'],maxResults:4,strictCountry:false,countryPolicy:'public-profile',translate:async()=>({US:'serum',GB:'serum'}),search:async()=>[{id:'a',platform:'TikTok',name:'serum',country:'',countryConfidence:'unverified'}]})
  assert.equal(result.data.length,1);assert.equal(result.data[0].country,'');assert.deepEqual(result.data[0].matchedMarkets,['US','GB'])
  assert.equal(result.search.markets[0].countryUnverified,1)
})
test('두 플랫폼은 총 요청 인원을 나눠 사용하고 일부 플랫폼 실패를 숨기지 않는다',async()=>{
  const items=await discoverPublicProfiles({query:'serum',sourceQuery:'serum',platform:'all',country:'US',maxResults:4,normalize,request:async({platform})=>{if(platform==='TikTok')throw Error('PRIVATE_TOKEN');return[{url:'https://instagram.com/alice',title:'serum review'}]}})
  assert.equal(items.length,1);assert.equal(items.searchMeta.partial,true);assert.equal(items.searchMeta.platforms[1].status,'failed');assert.equal(JSON.stringify(items.searchMeta).includes('PRIVATE_TOKEN'),false)
  assert.equal(items.searchMeta.platforms.reduce((n,p)=>n+p.requested,0),4)
})
test('잘못된 지역·공급자 오류를 정상 빈 결과로 숨기지 않는다',async()=>{
  await assert.rejects(discoverPublicProfiles({query:'serum',platform:'TikTok',country:'US',maxResults:1,normalize,request:async()=>{throw Object.assign(Error('invalid region'),{status:422})}}),e=>e.status===502)
})
test('호출 간격은 대기열로 보장하고 실패 후 복구하며 만료된 요청은 발송하지 않는다',async()=>{
  let time=100,calls=0;const starts=[]
  const pace=createProfileSearchPacer({intervalMs:1100,now:()=>time,wait:async ms=>{time+=ms}})
  const tasks=[pace(async()=>{starts.push(time);calls++;throw Error('failed')}),pace(async()=>{starts.push(time);calls++}),pace(async()=>{starts.push(time);calls++})]
  await Promise.allSettled(tasks);assert.deepEqual(starts,[100,1200,2300]);assert.equal(calls,3)
  await assert.rejects(pace(async()=>{calls++},2400),e=>e.status===504);assert.equal(calls,3)
})


test('명백한 판매점·플랫폼 계정은 제외하고 개인 크리에이터 근거는 보존한다',()=>{
  assert.equal(isLikelyCreatorProfile({name:'USA Beauty Super Store',handle:'@beauty.store'}),false)
  assert.equal(isLikelyCreatorProfile({name:'Beauty Clinic Official',handle:'@clinic'}),false)
  assert.equal(isLikelyCreatorProfile({name:'Alice Official',handle:'@alice',sourceSnippet:'Beauty creator and makeup artist'}),true)
  assert.equal(isLikelyCreatorProfile({name:'Alice',handle:'@alice',sourceSnippet:'뷰티 인플루언서'}),true)
  assert.equal(isLikelyCreatorProfile({name:'Creators',handle:'@creators',sourceSnippet:'creator community'}),false)
})

test('프로필 국기 표시는 텍스트 추정이며 다른 국가 검색으로 확정하지 않는다',()=>{
  const result=inferPublicProfileCountry({sourceTitle:'Beauty creator 🇺🇸',searchCountry:'JP'})
  assert.equal(result.country,'US');assert.equal(result.countryConfidence,'detected')
  assert.equal(inferPublicProfileCountry({sourceTitle:'Travel 🇺🇸 🇯🇵'}).countryEvidenceStatus,'ambiguous-public-text')
  assert.equal(isLikelyCreatorProfile({handle:'@user35378653048291',sourceTitle:'뷰티 인플루언서들 특'}),false)
})

test('캐나다는 선택·영어 검색·공개 텍스트 국가 추정을 지원한다',()=>{
  assert.deepEqual(braveMarketOptions('CA'),{country:'CA',language:'en'})
  assert.match(profileMarketQueries('beauty','Instagram','CA')[0],/Canada/)
  assert.equal(inferPublicProfileCountry({sourceTitle:'Beauty creator 🇨🇦',sourceSnippet:'Toronto'}).country,'CA')
})
