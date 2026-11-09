import assert from 'node:assert/strict'
import test from 'node:test'
import { findSavedInstagramReferences, instagramPostKey } from '../shared/instagramReferenceReuse.js'

test('matches saved references by keyword and country while keeping their original metrics', () => {
  const saved = { platform: 'Instagram', country: 'JP', mediaType: '영상', title: 'Beauty serum', url: 'https://www.instagram.com/reel/AbCdEf/?igsh=abc', views: 520000 }
  const duplicate = { ...saved, url: 'https://instagram.com/p/AbCdEf/' }
  const temporary = { ...saved, url: 'https://instagram.com/reel/OtherId/', searchOnly: true }
  const filters = { platform: '전체', country: 'JP', mediaType: '전체', query: 'SERUM beauty' }
  assert.deepEqual(findSavedInstagramReferences([temporary, saved, duplicate, { ...saved, country: 'KR' }], filters), [saved])
  assert.deepEqual(findSavedInstagramReferences([saved], { ...filters, platform: 'YouTube' }), [])
  assert.deepEqual(findSavedInstagramReferences([saved], { ...filters, query: 'beauty toner' }), [])
  assert.equal(instagramPostKey('https://instagram.com.example.com/reel/AbCdEf'), '')
  assert.notEqual(instagramPostKey('https://instagram.com/reel/abcdef'), instagramPostKey(saved.url))
})
