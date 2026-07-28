import fs from 'node:fs/promises'
import path from 'node:path'
import readXlsxFile from 'read-excel-file/node'

const root = process.cwd()
const workbookPath = path.join(root, 'tmp', 'media-data-definition.xlsx')
const outputPath = path.join(root, 'src', 'data', 'mediaDefinitionManifest.json')

const sourceByPlatform = {
  YouTube: ['RAW-EXT-CHN-001', 'RAW-EXT-CONT-001'],
  Instagram: ['RAW-EXT-CHN-001', 'RAW-EXT-CONT-001'],
  TikTok: ['RAW-EXT-CHN-001', 'RAW-EXT-CONT-001'],
  Twitter: ['RAW-EXT-SEARCH-001'],
  Facebook: ['RAW-EXT-SEARCH-001'],
  Blog: ['RAW-EXT-SEARCH-001'],
  Community: ['RAW-EXT-SEARCH-001'],
  Amazon: ['RAW-EXT-SEARCH-001'],
}

const clean = (value) => (value == null ? '' : String(value).replace(/\s+/g, ' ').trim())

function slug(value) {
  return clean(value)
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

function normalizePlatform(value) {
  const text = clean(value).replace(/\s*Data$/i, '')
  if (/youtube/i.test(text)) return 'YouTube'
  if (/instagram/i.test(text)) return 'Instagram'
  if (/tiktok/i.test(text)) return 'TikTok'
  if (/twitter|x\b/i.test(text)) return 'Twitter'
  if (/facebook/i.test(text)) return 'Facebook'
  if (/blog/i.test(text)) return 'Blog'
  if (/community/i.test(text)) return 'Community'
  if (/amazon/i.test(text)) return 'Amazon'
  return text || 'Common'
}

function implementationState(platform, feasibility, note) {
  const evidence = `${feasibility} ${note}`.toLowerCase()
  if (/불가|미지원|제한|없음|cannot|not available/.test(evidence)) return 'planned'
  if (/부분|조건|승인|수동|제한적/.test(evidence)) return 'partial'
  if (platform === 'YouTube') return 'implemented'
  if (['Instagram', 'TikTok'].includes(platform)) return 'partial'
  return 'planned'
}

const sheets = await readXlsxFile(workbookPath)
const sheet = sheets.find((entry) => clean(entry.sheet).startsWith('01.')) || sheets[0]
if (!sheet) throw new Error('Media definition sheet not found.')

let currentPlatform = ''
const counters = new Map()
const definitions = []

for (const row of sheet.data) {
  if (row[1] && /Data/i.test(clean(row[1]))) currentPlatform = normalizePlatform(row[1])
  const itemNumber = Number(row[1])
  const itemName = clean(row[3])
  if (!Number.isFinite(itemNumber) || itemNumber <= 0 || !itemName) continue

  const platform = currentPlatform || 'Common'
  const sequence = (counters.get(platform) || 0) + 1
  counters.set(platform, sequence)
  const sourceType = clean(row[5])
  const dataType = ['원천', '파생', '계산'].includes(sourceType) ? sourceType : '미분류'
  const feasibility = clean(row[7])
  const note = clean(row[8])

  definitions.push({
    definitionId: `MDF-${platform.toUpperCase()}-${String(sequence).padStart(3, '0')}`,
    sourceRow: itemNumber,
    platform,
    group: clean(row[2]),
    fieldName: itemName,
    fieldKey: slug(`${platform}-${itemName}`),
    sourceLocation: clean(row[4]),
    dataType,
    description: clean(row[6]),
    feasibility,
    note,
    developmentComment: clean(row[9]),
    connectedRawDataIds: sourceByPlatform[platform] || ['RAW-EXT-SEARCH-001'],
    implementationState: implementationState(platform, feasibility, note),
  })
}

const summary = definitions.reduce(
  (acc, item) => {
    acc.byType[item.dataType] = (acc.byType[item.dataType] || 0) + 1
    acc.byPlatform[item.platform] = (acc.byPlatform[item.platform] || 0) + 1
    acc.byState[item.implementationState] = (acc.byState[item.implementationState] || 0) + 1
    return acc
  },
  { total: definitions.length, byType: {}, byPlatform: {}, byState: {} },
)

await fs.mkdir(path.dirname(outputPath), { recursive: true })
await fs.writeFile(
  outputPath,
  `${JSON.stringify({
    source: '미핑기획 솔루션 1차.xlsx / 01. 미디어_데이터 정의',
    generatedAt: new Date().toISOString(),
    summary,
    definitions,
  }, null, 2)}\n`,
  'utf8',
)

console.log(`Generated ${definitions.length} media definitions at ${path.relative(root, outputPath)}`)
