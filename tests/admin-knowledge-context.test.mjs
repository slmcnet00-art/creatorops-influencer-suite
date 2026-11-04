import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAdminKnowledgeContext, assertKnowledgeCitations } from '../server/adminKnowledgeContext.js'

test('URL만 있는 자료는 본문 학습으로 표시하지 않고 실제 사용 본문·버전을 추적한다', () => {
  const config = { featureKey: 'content-guide', version: 'v4', attachments: [{ id: 'one', name: 'guide.md', text: '실제 규칙: 요리 과정을 증명한다.' }, { id: 'two', name: 'link.txt', sourceUrl: 'https://example.com' }] }
  const result = buildAdminKnowledgeContext('요리 레시피', config)
  assert.equal(result.trace.sources.length, 1)
  assert.equal(result.trace.unavailable.length, 1)
  assert.equal(result.trace.version, 'v4')
  assert.match(result.prompt, /실제 규칙/)
  const changed = buildAdminKnowledgeContext('요리 레시피', { ...config, attachments: [{ ...config.attachments[0], text: '새 규칙' }] })
  assert.notEqual(result.trace.sources[0].fingerprint, changed.trace.sources[0].fingerprint)
  assert.throws(() => assertKnowledgeCitations('일반적인 가이드', result.trace))
  assert.throws(() => assertKnowledgeCitations('[K:invented]', result.trace))
  assert.doesNotThrow(() => assertKnowledgeCitations(`[K:${result.trace.sources[0].citationId}] 적용: 실제 조리 장면 촬영`, result.trace))
})

test('큰 학습파일을 제한 내에서 선택하고 누락량을 숨기지 않는다', () => {
  const result = buildAdminKnowledgeContext('요리 레시피', { attachments: [{ id: 'large', name: 'large.txt', text: '다른 자료.\n'.repeat(5000) + '요리 레시피 핵심 원칙' }] }, { maxChars: 4000, perSourceChars: 3000 })
  assert.ok(result.trace.sources[0].usedChars <= 3000)
  assert.ok(result.trace.sources[0].truncated)
  assert.match(result.prompt, /요리 레시피 핵심 원칙/)
})
