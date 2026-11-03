// Numeric IDs are required by existing campaign/fulfillment selectors. Unlike
// Date.now()+random(1000), this allocator cannot collide in a search batch.
export function createDiscoveryIdFactory(now = Date.now) {
  let last = 0
  return () => { last = Math.max(now() * 1000, last + 1); return last }
}
export const nextDiscoveryId = createDiscoveryIdFactory()
