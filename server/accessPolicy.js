export const WORKSPACE_ROLES = new Set(['Owner', 'Admin', 'Manager', 'Marketer', 'Analyst', 'Client'])
export const WORKSPACE_MEMBER_STATUSES = new Set(['invited', 'active', 'disabled'])
export const FULL_WORKSPACE_ROLES = new Set(['Owner', 'Admin'])

function validationError(message, status = 400) {
  const error = new Error(message)
  error.status = status
  return error
}

export function normalizeBrandIds(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))]
}

export function prepareMemberAccessUpdate(currentMember, input = {}, activeOwnerCount = 0) {
  if (!currentMember) throw validationError('Workspace member not found.', 404)
  const role = String(input.role || currentMember.role || '').trim()
  const status = String(input.status || currentMember.status || '').trim()
  if (!WORKSPACE_ROLES.has(role)) throw validationError('Unsupported workspace role.')
  if (!WORKSPACE_MEMBER_STATUSES.has(status)) throw validationError('Unsupported workspace member status.')

  const removesActiveOwner = currentMember.role === 'Owner'
    && currentMember.status === 'active'
    && (role !== 'Owner' || status !== 'active')
  if (removesActiveOwner && activeOwnerCount <= 1) {
    throw validationError('The last active workspace owner cannot be demoted or disabled.', 409)
  }

  const brandIds = FULL_WORKSPACE_ROLES.has(role) ? [] : normalizeBrandIds(input.brandIds)
  if (status === 'active' && !FULL_WORKSPACE_ROLES.has(role) && brandIds.length === 0) {
    throw validationError('An active scoped member must retain at least one brand.', 409)
  }

  return { role, status, brandIds }
}

