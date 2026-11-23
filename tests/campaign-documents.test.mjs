import test from 'node:test'
import assert from 'node:assert/strict'
import { documentKind, prepareCampaignDocument, saveCampaignDocument } from '../shared/campaignDocuments.js'

test('legacy quote and contact references route to their operational surfaces', () => {
  assert.equal(documentKind({ name: '견적서 양식 보기' }), 'quote')
  assert.equal(documentKind({ name: '컨택 양식 폴더 열기' }), 'contact')
  assert.equal(documentKind({ name: '협업 자료', kind: 'contact' }), 'contact')
})
test('a saved quote preserves contact references and updates the same document rather than duplicating it', () => {
  const before = { id: 1, documents: [{ kind: 'contact', name: 'DM', url: 'https://example.com/dm' }] }
  const after = saveCampaignDocument(before, { name: '초안', url: 'https://example.com/quote' }, 'quote')
  const updated = saveCampaignDocument(after, { name: '확정', url: 'https://example.com/quote', status: '확정 견적' }, 'quote')
  assert.equal(before.documents.length, 1)
  assert.equal(updated.documents.length, 2)
  assert.equal(updated.documents[0].kind, 'contact')
  assert.equal(updated.documents[1].status, '확정 견적')
})
test('document references reject executable URLs, credentials and blank names', () => {
  for (const url of ['javascript:alert(1)', 'http://example.com/', 'https://user:secret@example.com/']) {
    assert.throws(() => prepareCampaignDocument({ name: '문서', url }, 'quote'))
  }
  assert.throws(() => prepareCampaignDocument({ name: ' ', url: 'https://example.com/' }, 'contact'))
})
