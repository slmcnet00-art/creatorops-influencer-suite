import 'dotenv/config'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { mergeCreatorSheetImport } from '../shared/creatorSheetImport.js'
import { mergeBrandWorkspaceSnapshots } from '../shared/brandWorkspaceSnapshots.js'
import { compareAndSwapSnapshot } from '../src/snapshotConcurrency.js'

const args = process.argv.slice(2)
const input = args[args.indexOf('--input') + 1]
if (!args.includes('--input') || !input) throw new Error('--input 그룹자료.json 경로를 지정해주세요.')
const bundle = JSON.parse(await readFile(input, 'utf8'))
mergeCreatorSheetImport({}, bundle) // Validate before connecting or writing.
console.log(JSON.stringify({ groups: bundle.creatorGroups.length, creators: bundle.creators.length, mode: args.includes('--apply') ? 'apply' : 'preview' }))
if (args.includes('--apply')) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const token = process.env.SUPABASE_SERVICE_ROLE_KEY
  const workspaceId = process.env.WORKSPACE_ID || 'miping-main'
  if (!url || !token) throw new Error('운영 DB 연결 설정이 필요합니다. 토큰을 명령줄 인자로 전달하지 마세요.')
  const client = createClient(url, token, { auth: { persistSession: false, autoRefreshToken: false } })
  let saved = false
  for (let attempt = 0; attempt < 3 && !saved; attempt += 1) {
    const [{ data: full, error: fullError }, { data: brands, error: brandError }] = await Promise.all([
      client.from('workspace_snapshots').select('payload,updated_at').eq('workspace_id', workspaceId).maybeSingle(),
      client.from('brand_scoped_snapshots').select('brand_id,payload,updated_at').eq('workspace_id', workspaceId),
    ])
    if (fullError || brandError) throw new Error(`DB 등록 중단: ${(fullError || brandError).message}`)
    if (attempt === 0) {
      const directory = path.join(process.env.TEMP || process.cwd(), 'creatorops-group-import-backups')
      await mkdir(directory, { recursive: true })
      await writeFile(path.join(directory, `${Date.now()}.json`), JSON.stringify({ workspaceId, full, brands }))
    }
    const latest = mergeBrandWorkspaceSnapshots(full?.payload || {}, brands || [])
    const merged = mergeCreatorSheetImport(latest, bundle)
    const brandId = bundle.brandId || 'creator-pool-library'
    const existing = brands.find(row => String(row.brand_id) === brandId)
    const groups = merged.creatorGroups.filter(group => String(group.brandId) === brandId)
    const ids = new Set(groups.flatMap(group => group.creatorIds.map(String)))
    const payload = { ...(existing?.payload || {}), brandId, brand: merged.brands.find(brand => String(brand.id) === brandId), creatorGroups: groups, creators: merged.creators.filter(creator => ids.has(String(creator.id))) }
    const scoped = await compareAndSwapSnapshot(client, 'brand_scoped_snapshots', { workspace_id: workspaceId, brand_id: brandId }, payload, existing?.updated_at)
    if (scoped.status !== 'saved') continue
    const result = await compareAndSwapSnapshot(client, 'workspace_snapshots', { workspace_id: workspaceId }, merged, full?.updated_at)
    if (result.status !== 'saved') continue
    const { data: check, error: readError } = await client.from('brand_scoped_snapshots').select('payload').eq('workspace_id', workspaceId).eq('brand_id', brandId).maybeSingle()
    if (readError) throw readError
    const stored = new Map((check?.payload?.creatorGroups || []).map(group => [group.sourceImportKey, group]))
    if (!bundle.creatorGroups.every(group => stored.has(group.sourceImportKey))) throw new Error('그룹 등록 후 재조회 검증에 실패했습니다.')
    console.log(JSON.stringify({ status: 'saved_and_verified', brandId, groups: groups.length, creators: payload.creators.length }))
    saved = true
  }
  if (!saved) throw new Error('동시 편집으로 등록을 완료하지 못했습니다. 기존 변경은 보존했으며 등록 작업은 재실행해도 중복 생성되지 않습니다.')
}
