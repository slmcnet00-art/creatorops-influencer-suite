import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('review policies have idempotent table prerequisites matching the canonical schema', () => {
  const migration = readFileSync(new URL('../supabase/migrations/202611260000_review_schema_prerequisites.sql', import.meta.url), 'utf8')
  const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8')
  const definitions = [...migration.matchAll(/create table if not exists public\.(\w+) \([\s\S]*?\n\);/g)]
  assert.equal(definitions.length, 12)
  for (const [definition, name] of definitions) {
    assert.ok(schema.includes(definition), `${name} must match schema.sql`)
    assert.ok(migration.includes(`alter table public.${name} enable row level security;`))
  }
  assert.doesNotMatch(migration, /^\s*(?:drop|delete|truncate)\b/im)
})
