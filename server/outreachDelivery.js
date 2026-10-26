import { createHash } from 'node:crypto'

export const outreachDeliveryId = (workspaceId, key) => `outreach-${createHash('sha256').update(`${workspaceId}:${key}`).digest('hex')}`

export async function claimDelivery(client, row) {
  const key = row.idempotency_key || row.metadata?.idempotencyKey
  if (!key) throw new Error('A durable delivery key is required.')
  const record = { ...row, id: outreachDeliveryId(row.workspace_id, key), metadata: { ...row.metadata, idempotencyKey: key } }
  // Base-table compatible: older deployments may not have the optional reliability columns.
  delete record.idempotency_key
  delete record.attempt_count
  delete record.last_error
  const { error } = await client.from('outreach_messages').insert(record)
  if (!error) return { claimed: true }
  if (error.code !== '23505') throw error
  const { data: existing, error: readError } = await client.from('outreach_messages')
    .select('id,status,provider_message_id,metadata').eq('workspace_id', row.workspace_id).eq('id', record.id).maybeSingle()
  if (readError) throw readError
  if (existing?.status === 'failed' && existing.metadata?.retrySafe === true && !existing.provider_message_id) {
    const { data, error: retryError } = await client.from('outreach_messages').update({ ...record, id: existing.id })
      .eq('id', existing.id).eq('status', 'failed').is('provider_message_id', null).select('id').maybeSingle()
    if (retryError) throw retryError
    return { claimed: Boolean(data), existing }
  }
  return { claimed: false, existing }
}

export const isDefinitiveDeliveryFailure = error => Number(error?.status) >= 400 && Number(error?.status) < 500 && Number(error?.status) !== 408 && !error?.deliveryAccepted
