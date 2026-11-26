export function snapshotMergeDecision(remoteVersion, acknowledgedVersion, hasPendingEdits) {
  if (remoteVersion === acknowledgedVersion) return 'ignore'
  return hasPendingEdits ? 'conflict' : 'merge'
}

export function brandSnapshotSignature(versions) {
  return Object.entries(versions).map(([id, version]) => `${id}:${version || ''}`).sort().join('|')
}
