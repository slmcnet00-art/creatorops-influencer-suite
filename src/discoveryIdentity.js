// Numeric IDs are required by existing campaign/fulfillment selectors. Unlike
// Date.now()+random(1000), this allocator cannot collide in a search batch.
export function createDiscoveryIdFactory(now = Date.now) {
  let last = 0
  return () => { last = Math.max(now() * 1000, last + 1); return last }
}
export const nextDiscoveryId = createDiscoveryIdFactory()

// A result may be merged into an existing numeric ID after React runs the updater.
// Select by its stable profile instead of mutating a local ID inside that updater.
export function discoverySelectionKey(creator) {
  return creator.profileUrl ? `profile:${String(creator.profileUrl).toLowerCase()}` : creator.id
}
export function matchesDiscoverySelection(creator, selection) {
  return creator.id === selection || discoverySelectionKey(creator) === selection
}
