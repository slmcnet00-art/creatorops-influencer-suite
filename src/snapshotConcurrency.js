// PostgREST conditional UPDATE is a single database statement, not read-then-upsert.
export async function compareAndSwapSnapshot(client, table, keys, payload, expectedUpdatedAt) {
  const updatedAt = new Date(Math.max(Date.now(), (Date.parse(expectedUpdatedAt) || 0) + 1)).toISOString()
  let query = expectedUpdatedAt
    ? client.from(table).update({ payload, updated_at: updatedAt })
    : client.from(table).insert({ ...keys, payload, updated_at: updatedAt })
  if (expectedUpdatedAt) {
    for (const [key, value] of Object.entries(keys)) query = query.eq(key, value)
    query = query.eq('updated_at', expectedUpdatedAt)
  }
  const { data, error } = await query.select('payload,updated_at').maybeSingle()
  if (error && error.code !== '23505') throw error
  if (data && !error) return { status: 'saved', payload: data.payload, updatedAt: data.updated_at }
  let latest = client.from(table).select('payload,updated_at')
  for (const [key, value] of Object.entries(keys)) latest = latest.eq(key, value)
  const { data: current, error: readError } = await latest.maybeSingle()
  if (readError) throw readError
  return { status: 'conflict', payload: current?.payload ?? null, updatedAt: current?.updated_at ?? null }
}
