import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildReusableTemplateLearningMaterial,
  buildReusableTemplateLearningMaterials,
  getApprovedContentTemplates,
} from '../src/contentTemplateLibrary.js'

const templates = [
  { id: 'old', brandId: 1, status: 'approved', name: '이전 템플릿', createdAt: '2026-09-01' },
  { id: 'new', brandId: 1, status: 'approved', name: '최근 템플릿', updatedAt: '2026-09-03' },
  { id: 'other', brandId: 2, status: 'approved', name: '다른 브랜드' },
  { id: 'draft', brandId: 1, status: 'draft', name: '검토 중' },
]

test('현재 브랜드의 승인된 위닝 소재만 최신순으로 반환한다', () => {
  assert.deepEqual(getApprovedContentTemplates(templates, 1).map((item) => item.id), ['new', 'old'])
})

test('위닝 소재를 전략과 가이드가 읽는 학습자료로 변환한다', () => {
  const material = buildReusableTemplateLearningMaterial({
    id: 'winner-1',
    name: '문제 해결형 숏폼',
    sourceType: 'owned_campaign',
    platform: 'TikTok',
    performanceReason: '팔로워 대비 조회 4.2배',
    structureAnalysis: {
      hook: '첫 1초에 문제 제시',
      flow: '문제 → 사용 → 결과',
      proof: '실사용 장면',
      cta: '댓글 질문',
    },
  })

  assert.equal(material.sourceType, 'approved_content_template')
  assert.match(material.summary, /팔로워 대비 조회 4.2배/)
  assert.match(material.doSay, /문제 → 사용 → 결과/)
  assert.match(material.dontSay, /그대로 복제하지 말고/)
})

test('승인된 템플릿만 학습자료 목록에 포함한다', () => {
  assert.equal(buildReusableTemplateLearningMaterials(templates, 1).length, 2)
})
