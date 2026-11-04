import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { operationalCandidateView } from '../src/operationalCandidates.js'
import { campaignGenerationInput, creatorGenerationInput } from '../shared/campaignGenerationInput.js'
import { resolveGuideChannel, getCampaignGuideReferences, guideEvidenceAppendix, buildJapaneseIndividualGuide } from '../src/campaignGuideEvidence.js'

test('예시 후보는 운영 목록·캠페인·그룹·AI 입력에서 제외하며 원본은 보존한다', () => {
  const original = { creators: [{ id: 1, isDemo: true }, { id: 2, contactEmail: 'test@creator.example' }, { id: 3, name: '실제' }], shortlist: [1, 2, 3], campaigns: [{ id: 'c', creatorIds: [1, 3] }], creatorGroups: [{ creatorIds: [2] }, { creatorIds: [1, 3] }], recommendations: [{ creatorId: 1 }, { creatorId: 3 }] }
  const view = operationalCandidateView(original)
  assert.deepEqual(view.creators.map((row) => row.id), [3])
  assert.deepEqual(view.shortlist, [3])
  assert.deepEqual(view.campaigns[0].creatorIds, [3])
  assert.equal(view.creatorGroups.length, 1)
  assert.deepEqual(view.recommendations, [{ creatorId: 3 }])
  assert.equal(original.creators.length, 3)
  assert.deepEqual(original.campaigns[0].creatorIds, [1, 3])
})

test('유튜브 캠페인의 숏폼·롱폼 형식을 Instagram으로 바꾸지 않는다', () => {
  assert.equal(resolveGuideChannel({ preferredPlatforms: 'YouTube', contentFormats: ['숏폼', '롱폼'], guideChannel: 'Instagram Reels' }), 'YouTube Shorts + YouTube Longform')
})

test('다른 캠페인·미선택 레퍼런스를 섞지 않고 채널 평균조회로 영상 성공을 만들지 않는다', () => {
  const refs = getCampaignGuideReferences({ id: 'c', creatorIds: [3] }, [
    { id: 'a', campaignId: 'other', url: 'https://example.com/other' },
    { id: 'b', campaignId: 'c', title: '저장 영상', url: 'https://youtube.com/watch?v=a', views: 800000, source: 'YouTube Data API videos.list' },
  ], ['a', 'b'], [{ id: 3, sourceTitle: '발굴 영상', matchedContentUrl: 'https://youtube.com/watch?v=b', averageViews: 9000000 }])
  assert.equal(refs.length, 2)
  assert.equal(refs[1].views, undefined)
  const appendix = guideEvidenceAppendix(refs)
  assert.match(appendix, /800,000회/)
  assert.match(appendix, /영상별 조회 성과 미검증/)
  assert.doesNotMatch(appendix, /9,000,000/)
  assert.match(guideEvidenceAppendix(), /검증된 레퍼런스가 없습니다/)
})

test('전략→공통→개별 가이드가 실제 내용과 레퍼런스를 전달하고 화면에서 전체를 읽을 수 있다', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /operationalCandidateView\(workspace\)/)
  assert.match(app, /\.\.\.referenceMaterials/)
  assert.match(app, /guide \+= guideEvidenceAppendix\(evidenceReferences, campaign.outputLanguage\)/)
  assert.match(app, /실행에 사용할 공통 촬영안과 레퍼런스[\s\S]*?\$\{commonGuide\}/)
  assert.match(app, /if \(!campaign.influencerStrategy\)/)
  assert.match(app, /if \(!campaign.generatedContentGuide\)/)
  assert.equal((app.match(/공통 가이드 전체 보기/g) || []).length, 2)
  assert.doesNotMatch(app, /influencerStrategy.slice\(0, 900\)|50만 이상 조회 레퍼런스/)
})

test('일본 크리에이터용 가이드는 일본어 안내와 실제 공통 촬영안·원본 링크를 포함한다', () => {
  const text = buildJapaneseIndividualGuide({ campaign: { name: '일본 2' }, creator: { name: 'MYON', platform: 'YouTube', matchedContentUrl: 'https://youtube.com/watch?v=a' }, commonGuide: '00:03 アプリの実画面を録画' })
  assert.match(text, /00:03 アプリの実画面を録画/)
  assert.match(text, /https:\/\/youtube.com\/watch\?v=a/)
  assert.match(text, /未発行のリンク/)
  assert.match(guideEvidenceAppendix([{ url: 'https://youtube.com/watch?v=a', views: 500000 }], 'ja'), /500,000回/)
})

test('과거 생성물이 다음 전략의 사실 근거로 재입력되지 않으며 가이드에는 현재 전략만 전달한다', () => {
  const campaign = { id: 'c', influencerStrategy: 'approved strategy', generatedContentGuide: 'old guide', individualContentGuides: { 1: 'old personal guide' }, budget: 0 }
  assert.deepEqual(campaignGenerationInput(campaign), { id: 'c', budget: 0 })
  assert.deepEqual(campaignGenerationInput(campaign, { includeStrategy: true }), { id: 'c', budget: 0, influencerStrategy: 'approved strategy' })
  assert.equal(campaign.generatedContentGuide, 'old guide')
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /baseCampaignBrief = buildCampaignBriefFromCampaign\(campaignGenerationInput\(campaign\)\)/)
  assert.match(app, /baseCampaignBrief = buildCampaignBriefFromCampaign\(campaignGenerationInput\(campaign, \{ includeStrategy: true \}\)\)/)
})

test('계산한 참여율·위험도·가격이 전략의 검증된 사실로 전달되지 않는다', () => {
  assert.deepEqual(creatorGenerationInput({ id: 2, name: '요리', followers: 50000, engagement: 12, brandSafety: 94, fakeRisk: 6, price: 15000000, averageViews: 900000 }), { id: 2, name: '요리', followers: 50000 })
})
