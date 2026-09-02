import assert from 'node:assert/strict'
import test from 'node:test'
import { getAiOutputPolicyState, getGeneratedPolicyVersion } from '../src/aiPolicyVersions.js'

test('기능별로 분리 저장된 정책 버전을 우선 사용한다', () => {
  const generationState = {
    packageVersion: 'legacy-v1',
    policyFeatureKey: 'content-guide',
    strategyPolicyVersion: 'strategy-v3',
  }
  assert.equal(getGeneratedPolicyVersion(generationState, 'campaign-strategy'), 'strategy-v3')
  assert.equal(getGeneratedPolicyVersion(generationState, 'content-guide'), 'legacy-v1')
})

test('AI 추천 생성 이력에서 추천 정책 버전을 읽는다', () => {
  assert.equal(
    getGeneratedPolicyVersion(
      {
        recommendationPolicyVersion: 'v5',
        policyFeatureKey: 'creator-recommendation',
      },
      'creator-recommendation',
    ),
    'v5',
  )
})

test('현재 활성 정책과 같은 버전은 최신 상태다', () => {
  const result = getAiOutputPolicyState({
    activePolicy: { version: 'v2' },
    generationState: { strategyPolicyVersion: 'v2' },
    featureKey: 'campaign-strategy',
    hasOutput: true,
  })
  assert.equal(result.status, 'current')
  assert.equal(result.needsRegeneration, false)
})

test('정책 버전이 바뀌면 기존 산출물을 재생성 대상으로 표시한다', () => {
  const result = getAiOutputPolicyState({
    activePolicy: { version: 'v3' },
    generationState: { guidePolicyVersion: 'v2' },
    featureKey: 'content-guide',
    hasOutput: true,
  })
  assert.equal(result.status, 'stale')
  assert.equal(result.generatedVersion, 'v2')
  assert.equal(result.activeVersion, 'v3')
  assert.equal(result.needsRegeneration, true)
})

test('버전 이력이 없는 기존 산출물은 재생성을 권장한다', () => {
  const result = getAiOutputPolicyState({
    activePolicy: { version: 'v3' },
    generationState: {},
    featureKey: 'campaign-strategy',
    hasOutput: true,
  })
  assert.equal(result.status, 'unknown')
  assert.equal(result.needsRegeneration, true)
})
