export const teamRoleCatalog = {
  Owner: {
    label: '운영 총괄',
    description: '팀/계정/권한/전체 브랜드를 관리합니다.',
    dataScope: '전체 브랜드 DB',
    permissions: ['전체 데이터', '권한 부여', '삭제/초기화', '다운로드'],
  },
  Admin: {
    label: '관리자',
    description: '브랜드와 캠페인 운영을 관리합니다.',
    dataScope: '전체 브랜드 DB',
    permissions: ['브랜드 관리', '캠페인 관리', '데이터 다운로드'],
  },
  Manager: {
    label: '브랜드 매니저',
    description: '배정된 브랜드의 발굴, 메시지, 리포트를 운영합니다.',
    dataScope: '배정 브랜드 DB',
    permissions: ['발굴', '메시지', '리포트'],
  },
  Marketer: {
    label: '마케터',
    description: '배정된 브랜드의 캠페인 실행과 크리에이터 커뮤니케이션을 담당합니다.',
    dataScope: '배정 브랜드 운영 DB',
    permissions: ['캠페인', '발굴', '후보 그룹', '메시지'],
  },
  Analyst: {
    label: '분석 담당',
    description: '배정된 브랜드의 데이터 품질과 성과 리포트를 확인합니다.',
    dataScope: '배정 브랜드 리포트',
    permissions: ['데이터 검토', '리포트 보기'],
  },
  Client: {
    label: '클라이언트',
    description: '배정된 브랜드의 승인용 풀과 리포트를 봅니다.',
    dataScope: '배정 브랜드 승인/리포트',
    permissions: ['컨펌 보기', '리포트 보기'],
  },
}

export const fullBrandAccessRoles = new Set(['Owner', 'Admin'])

const sectionAccessByRole = {
  Owner: ['dashboard', 'campaigns', 'discovery', 'groups', 'messages', 'report', 'references', 'settings'],
  Admin: ['dashboard', 'campaigns', 'discovery', 'groups', 'messages', 'report', 'references', 'settings'],
  Manager: ['dashboard', 'campaigns', 'discovery', 'groups', 'messages', 'report', 'references', 'settings'],
  Marketer: ['dashboard', 'campaigns', 'discovery', 'groups', 'messages', 'report', 'references', 'settings'],
  Analyst: ['dashboard', 'report', 'settings'],
  Client: ['dashboard', 'campaigns', 'groups', 'report', 'references', 'settings'],
}

export function normalizeRole(role) {
  return teamRoleCatalog[role] ? role : 'Manager'
}

export function canManageTeamPermissions(account) {
  return fullBrandAccessRoles.has(normalizeRole(account?.role))
}

export function getAccessibleSectionIds(account) {
  return sectionAccessByRole[normalizeRole(account?.role)] ?? sectionAccessByRole.Manager
}

export function canAccessSection(account, sectionId) {
  return getAccessibleSectionIds(account).includes(sectionId)
}

export function getAccountBrandIds(account, brands) {
  if (!account) return []
  const allBrandIds = brands.map((brand) => brand.id)
  if (fullBrandAccessRoles.has(normalizeRole(account.role))) return allBrandIds
  const allowedIds = new Set(account.brandIds ?? [])
  return allBrandIds.filter((brandId) => allowedIds.has(brandId))
}

export function getAccessibleBrands(account, brands) {
  const accessibleIds = new Set(getAccountBrandIds(account, brands))
  return brands.filter((brand) => accessibleIds.has(brand.id))
}

export function getAccountBrandScopeLabel(account, brands) {
  const role = normalizeRole(account?.role)
  if (fullBrandAccessRoles.has(role)) return `전체 ${brands.length}개 브랜드`
  return `${getAccountBrandIds(account, brands).length}/${brands.length}개 브랜드`
}

export function buildPermissionTestAccounts(brands) {
  const brandIds = brands.map((brand) => brand.id)
  const firstBrandId = brandIds[0]
  const secondBrandId = brandIds[1] ?? firstBrandId

  return [
    {
      id: 'acct-admin-test', name: '권한 테스트 관리자', email: 'admin.test@miping.co.kr', role: 'Admin',
      status: '권한 테스트용', brandIds, lastActive: '방금 생성',
    },
    {
      id: 'acct-marketer-test', name: '단일 브랜드 마케터', email: 'marketer.test@miping.co.kr', role: 'Marketer',
      status: '권한 테스트용', brandIds: [secondBrandId].filter(Boolean), lastActive: '방금 생성',
    },
    {
      id: 'acct-analyst-test', name: '복수 브랜드 분석 담당', email: 'analyst.test@miping.co.kr', role: 'Analyst',
      status: '권한 테스트용',
      brandIds: [firstBrandId, secondBrandId].filter((brandId, index, items) => brandId && items.indexOf(brandId) === index),
      lastActive: '방금 생성',
    },
    {
      id: 'acct-client-test', name: '단일 브랜드 클라이언트', email: 'client.test@brand.co.kr', role: 'Client',
      status: '권한 테스트용', brandIds: [firstBrandId].filter(Boolean), lastActive: '방금 생성',
    },
  ]
}

export function mergePermissionTestAccounts(accounts, brands) {
  const fixtures = buildPermissionTestAccounts(brands)
  const fixtureIds = new Set(fixtures.map((account) => account.id))
  return [...accounts.filter((account) => !fixtureIds.has(account.id)), ...fixtures]
}
