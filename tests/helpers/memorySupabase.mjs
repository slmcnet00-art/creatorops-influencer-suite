import { isDeepStrictEqual } from 'node:util'

export function memorySupabase(seed = {}) {
  const tables = structuredClone(seed)
  let serial = 1
  const client = { tables, failInsert: '', from(table) {
    const filters = [], orders = [], predicates = []
    let action = 'read', patch, maximum = Infinity, shape = 'many'
    const q = {
      select() { return q }, insert(value) { action = 'insert'; patch = value; return q },
      update(value) { action = 'update'; patch = value; return q },
      eq(key, value) { filters.push([key, value]); return q }, order(key, opts = {}) { orders.push([key, opts.ascending !== false]); return q },
      lt(key, value) { predicates.push(row => valueAt(row, key) < value); return q },
      not(key, _op, _value) { predicates.push(row => valueAt(row, key) != null); return q },
      is(key, value) { predicates.push(row => value == null ? valueAt(row, key) == null : valueAt(row, key) === value); return q },
      limit(n) { maximum = n; return q }, single() { shape = 'single'; return execute() }, maybeSingle() { shape = 'maybe'; return execute() },
      then(resolve, reject) { return execute().then(resolve, reject) },
    }
    function valueAt(row, key) {
      if (key.includes('->>')) { const [parent, child] = key.split('->>'); return row[parent]?.[child] }
      if (key.includes('->')) { const [parent, child] = key.split('->'); return row[parent]?.[child] }
      return row[key]
    }
    const matches = row => filters.every(([key, value]) => {
      const actual = valueAt(row, key)
      if (['metadata', 'input_payload'].includes(key) && typeof value === 'string') return isDeepStrictEqual(actual, JSON.parse(value))
      return String(actual) === String(value)
    })
    async function execute() {
      tables[table] ||= []
      let rows
      if (action === 'insert') {
        if (client.failInsert === table) return { data: null, error: { code: 'unavailable' } }
        const inputs = Array.isArray(patch) ? patch : [patch]
        const duplicate = inputs.some(row => tables[table].some(existing => table === 'brand_scoped_snapshots'
          ? row.workspace_id === existing.workspace_id && row.brand_id === existing.brand_id
          : row.id != null && row.id === existing.id))
        if (duplicate) return { data: null, error: { code: '23505' } }
        rows = inputs.map(row => ({ id: serial++, created_at: new Date().toISOString(), ...structuredClone(row) }))
        tables[table].push(...rows)
      } else {
        rows = tables[table].filter(row => matches(row) && predicates.every(fn => fn(row)))
        if (action === 'update') rows.forEach(row => Object.assign(row, structuredClone(patch)))
      }
      rows = [...rows]
      for (const [key, asc] of orders) rows.sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * (asc ? 1 : -1))
      rows = rows.slice(0, maximum)
      return { data: structuredClone(shape === 'many' ? rows : rows[0] || null), error: shape === 'single' && !rows.length ? { code: 'missing' } : null }
    }
    return q
  } }
  return client
}
