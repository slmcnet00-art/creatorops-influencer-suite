import fs from 'node:fs'

const manifestPath = new URL('../src/data/mediaDefinitionManifest.json', import.meta.url)
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const definitions = manifest.definitions || []
const requiredFields = [
  'definitionId',
  'platform',
  'fieldName',
  'dataType',
  'connectedRawDataIds',
  'implementationState',
]
const allowedTypes = new Set(['원천', '파생', '계산', '미분류'])
const allowedStates = new Set(['implemented', 'partial', 'planned'])
const errors = []

for (const item of definitions) {
  for (const field of requiredFields) {
    if (item[field] == null || item[field] === '' || (Array.isArray(item[field]) && item[field].length === 0)) {
      errors.push(`${item.definitionId || 'unknown'}: missing ${field}`)
    }
  }
  if (!allowedTypes.has(item.dataType)) errors.push(`${item.definitionId}: invalid dataType ${item.dataType}`)
  if (!allowedStates.has(item.implementationState)) {
    errors.push(`${item.definitionId}: invalid implementationState ${item.implementationState}`)
  }
}

const duplicateIds = definitions
  .map((item) => item.definitionId)
  .filter((id, index, values) => values.indexOf(id) !== index)
if (duplicateIds.length) errors.push(`duplicate definition IDs: ${[...new Set(duplicateIds)].join(', ')}`)

if (definitions.length !== 117) errors.push(`expected 117 definitions, received ${definitions.length}`)

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log(`Media definition verification passed: ${definitions.length}/117 mapped`)
console.log(JSON.stringify(manifest.summary, null, 2))
