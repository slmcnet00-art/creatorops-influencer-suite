export const FULL_WORKSPACE_ROLES = new Set(['Owner', 'Admin'])
export const BRAND_WRITE_ROLES = new Set(['Owner', 'Admin', 'Manager', 'Marketer'])

export function canReadFullWorkspace(role) {
  return FULL_WORKSPACE_ROLES.has(String(role || ''))
}

export function canWriteFullWorkspace(role) {
  return FULL_WORKSPACE_ROLES.has(String(role || ''))
}

export function canWriteBrandWorkspace(role) {
  return BRAND_WRITE_ROLES.has(String(role || ''))
}

