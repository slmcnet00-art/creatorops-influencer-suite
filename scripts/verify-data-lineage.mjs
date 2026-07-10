import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

const runtimeFiles = [
  'src/App.jsx',
  'src/AdminDataRoom.jsx',
  'src/dataConnectors.js',
  'server/index.js',
]

const documentationFiles = [
  'API_INTEGRATION_CONTRACT.md',
  'DATA_ROOM_BACKEND_PLAN.md',
  'DEVELOPMENT_DEFINITION.md',
  'README.md',
]

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

const unique = (items) => [...new Set(items)].sort((a, b) => a.localeCompare(b))

function collectTokens(text, prefix) {
  const pattern = prefix === 'RAW'
    ? /(?<![A-Z0-9-])RAW-[A-Z0-9-]+(?![A-Z0-9-])/g
    : /(?<![A-Z0-9-])MET-[A-Z0-9-]+(?![A-Z0-9-])/g
  return text.match(pattern) || []
}

function collectRawCatalogIds(text) {
  const ids = []
  const rawObjectPattern = /id:\s*['"](RAW-[A-Z0-9-]+)['"]/g
  let match
  while ((match = rawObjectPattern.exec(text))) ids.push(match[1])
  return ids
}

function collectMetricCatalogIds(text) {
  const ids = []
  const metricRowPattern = /\[\s*['"](MET-[A-Z0-9-]+)['"]\s*,/g
  let match
  while ((match = metricRowPattern.exec(text))) ids.push(match[1])
  return ids
}

function collectFromFiles(files, prefix) {
  return files.flatMap((file) => collectTokens(read(file), prefix).map((id) => ({ file, id })))
}

const appSource = read('src/App.jsx')
const adminSource = read('src/AdminDataRoom.jsx')

const rawCatalogIds = unique([
  ...collectRawCatalogIds(appSource),
  ...collectRawCatalogIds(adminSource),
])

const metricCatalogIds = unique([
  ...collectMetricCatalogIds(appSource),
  ...collectMetricCatalogIds(adminSource),
])

const runtimeRawRefs = collectFromFiles(runtimeFiles, 'RAW')
const runtimeMetricRefs = collectFromFiles(runtimeFiles, 'MET')
const documentationRawRefs = collectFromFiles(documentationFiles, 'RAW')
const documentationMetricRefs = collectFromFiles(documentationFiles, 'MET')

function findMissing(refs, catalogIds) {
  const catalog = new Set(catalogIds)
  const byId = new Map()
  for (const { file, id } of refs) {
    if (catalog.has(id)) continue
    if (!byId.has(id)) byId.set(id, new Set())
    byId.get(id).add(file)
  }
  return [...byId.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, files]) => ({ id, files: [...files].sort() }))
}

const missingRuntimeRaw = findMissing(runtimeRawRefs, rawCatalogIds)
const missingRuntimeMetrics = findMissing(runtimeMetricRefs, metricCatalogIds)
const missingDocRaw = findMissing(documentationRawRefs, rawCatalogIds)
const missingDocMetrics = findMissing(documentationMetricRefs, metricCatalogIds)

const report = {
  rawCatalogCount: rawCatalogIds.length,
  metricCatalogCount: metricCatalogIds.length,
  runtimeRawReferenceCount: unique(runtimeRawRefs.map((item) => item.id)).length,
  runtimeMetricReferenceCount: unique(runtimeMetricRefs.map((item) => item.id)).length,
  missingRuntimeRaw,
  missingRuntimeMetrics,
  missingDocRaw,
  missingDocMetrics,
}

console.log(JSON.stringify(report, null, 2))

if (missingRuntimeRaw.length || missingRuntimeMetrics.length) {
  console.error('\nData lineage verification failed: runtime references must exist in the data room catalog.')
  process.exit(1)
}
