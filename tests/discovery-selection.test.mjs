import test from 'node:test'
import assert from 'node:assert/strict'
import { discoverySelectionKey, matchesDiscoverySelection } from '../src/discoveryIdentity.js'

test('다시 검색한 채널의 임시 ID가 저장된 ID로 합쳐져도 프로필 기준으로 새 상세를 선택한다', () => {
  const incoming = { id: 999, platform: 'YouTube', profileUrl: 'https://www.youtube.com/@Recipe' }
  const stored = { ...incoming, id: 12, averageViews: 300, youtubeRecentMetrics: { sampleCount: 12 } }
  const selection = discoverySelectionKey(incoming)
  assert.equal(matchesDiscoverySelection(stored, selection), true)
  assert.equal(matchesDiscoverySelection({ id: 13, profileUrl: 'https://www.youtube.com/@Other' }, selection), false)
  assert.equal(matchesDiscoverySelection(stored, 12), true)
  assert.equal(matchesDiscoverySelection(stored, 999), false)
})
