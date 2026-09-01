import {
  CREATOROPS_FEATURE_LEARNING_SOURCES,
  CREATOROPS_LEARNING_FOLDERS,
  CREATOROPS_LEARNING_ROOT_URL,
  CREATOROPS_STRATEGY_UPLOAD_URL,
  getCreatorOpsLearningSources,
} from '../shared/creatorOpsLearningSources.js'

const apiBaseUrl = String(process.argv[2] || process.env.CREATOROPS_API_BASE_URL || 'https://creatorops-suite-api.onrender.com').replace(/\/$/, '')
const version = 'v1.1-drive-2026-09-02'

async function jsonRequest(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`${path}: ${payload.message || payload.error || response.status}`)
  return payload
}

const currentPayload = await jsonRequest('/admin/ai-configs')
const currentConfigs = new Map((currentPayload.data?.configs || []).map((config) => [config.featureKey || config.id, config]))
const importedByDriveId = new Map()

async function importSource(featureKey, source) {
  if (importedByDriveId.has(source.id)) return importedByDriveId.get(source.id)
  const payload = await jsonRequest(`/admin/ai-configs/${featureKey}/import-url`, {
    method: 'POST',
    body: JSON.stringify({ url: source.sourceUrl }),
  })
  const attachment = {
    ...payload.data.attachment,
    id: `drive-${source.id}`,
    name: source.name,
    sourceType: 'google_drive',
    sourceUrl: source.sourceUrl,
    sourceFolderUrl: CREATOROPS_LEARNING_FOLDERS[source.folderKey]?.url || CREATOROPS_LEARNING_ROOT_URL,
    sourceModifiedAt: source.modifiedAt,
  }
  importedByDriveId.set(source.id, attachment)
  process.stdout.write(`읽기 완료 · ${source.name}\n`)
  return attachment
}

for (const featureKey of Object.keys(CREATOROPS_FEATURE_LEARNING_SOURCES)) {
  const attachments = []
  for (const source of getCreatorOpsLearningSources(featureKey)) {
    attachments.push(await importSource(featureKey, source))
  }
  const current = currentConfigs.get(featureKey) || {}
  const nextConfig = {
    ...current,
    featureKey,
    attachments,
    version,
    status: 'active',
    sourceRootUrl: CREATOROPS_LEARNING_ROOT_URL,
    sourceFolderUrl: CREATOROPS_LEARNING_FOLDERS[featureKey].url,
    strategyUploadUrl: CREATOROPS_STRATEGY_UPLOAD_URL,
    sourceSyncedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  await jsonRequest(`/admin/ai-configs/${featureKey}`, { method: 'PUT', body: JSON.stringify(nextConfig) })
  process.stdout.write(`활성화 완료 · ${featureKey} · ${attachments.length}개\n`)
}

const verified = await jsonRequest('/admin/ai-configs')
const summary = (verified.data?.configs || [])
  .filter((config) => CREATOROPS_FEATURE_LEARNING_SOURCES[config.featureKey])
  .map((config) => ({ featureKey: config.featureKey, status: config.status, version: config.version, attachments: config.attachments?.length || 0 }))

process.stdout.write(`${JSON.stringify({ apiBaseUrl, summary }, null, 2)}\n`)
