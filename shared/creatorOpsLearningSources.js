export const CREATOROPS_LEARNING_ROOT_URL = 'https://drive.google.com/drive/folders/1nJT0g8GvbvNX2xzqVBCaIGHdIRdQWEvo'
export const CREATOROPS_STRATEGY_UPLOAD_URL = 'https://drive.google.com/drive/folders/15N-WwgtT4YartS9I1GoZKjl0n11F1kmU'

export const CREATOROPS_LEARNING_FOLDERS = {
  common: { label: '0. 공통', url: 'https://drive.google.com/drive/folders/1KJZJHWaCDnITyVdEwn9iv9JAfKwE2shI' },
  'creator-recommendation': { label: '1. AI 인플루언서 추천', url: 'https://drive.google.com/drive/folders/1AFb6kWsxnrWldYEXN0mc7xi30QwRaaog' },
  'campaign-strategy': { label: '2. 캠페인 전략 생성', url: 'https://drive.google.com/drive/folders/1gtwJlmHOTkxVO204qEsxR7qjldoMPzjK' },
  'content-guide': { label: '3. 인플루언서 가이드 생성', url: 'https://drive.google.com/drive/folders/1vSFamqVVTqJ9c__4KitA5VC31mUL5PRU' },
  'outreach-message': { label: '4. 제안 메시지 생성', url: 'https://drive.google.com/drive/folders/1XklHoVx04r_o0dM96TfFZTpxrZaSCFoz' },
  'reference-analysis': { label: '5. 레퍼런스 분석', url: 'https://drive.google.com/drive/folders/1B4Yq5FgutY4O1kQShs7e-LkZW82urqYI' },
  strategyUpload: { label: '6. 전략서 업로드', url: CREATOROPS_STRATEGY_UPLOAD_URL },
  developer: { label: '9. 개발팀 부록', url: 'https://drive.google.com/drive/folders/1_DSVlUvdhKyPZG5BlzihQs6bgw5Rz-_D' },
}

export const CREATOROPS_FEATURE_POLICY_DEFAULTS = {
  'creator-recommendation': {
    name: 'AI 인플루언서 추천',
    description: '캠페인 브리프와 실제 후보 데이터를 바탕으로 추천 근거, 제안 각도, 주의점을 생성합니다.',
    systemPrompt: '브랜드 적합성과 조회 성과를 우선하되 제공된 원천 데이터만 사용합니다. 확인되지 않은 수치를 만들지 않습니다.',
    rules: '조회수 폭발력, 평균 조회수, 참여율, 콘텐츠 적합성, 데이터 신뢰도를 함께 평가합니다.',
  },
  'campaign-strategy': {
    name: '캠페인 전략 생성',
    description: '브랜드·제품·타깃·KPI를 바탕으로 실행 가능한 캠페인 전략을 생성합니다.',
    systemPrompt: '브랜드 목표를 실행 구조, 콘텐츠 메시지, 채널별 역할, KPI로 구체화합니다.',
    rules: '허위 후기, 여론 조작, 성과 보장은 제안하지 않습니다. 합법적인 협찬·광고 전략만 생성합니다.',
  },
  'content-guide': {
    name: '인플루언서 가이드 생성',
    description: '캠페인 전략과 저장한 제작 레퍼런스를 크리에이터 전달용 가이드로 변환합니다.',
    systemPrompt: '크리에이터가 바로 촬영할 수 있도록 원메시지, 후킹, 컷 구성, 필수 노출, 금지 표현을 구체적으로 작성합니다.',
    rules: '내부 계산식과 raw 데이터 ID는 최종 가이드에 노출하지 않습니다.',
  },
  'outreach-message': {
    name: '제안 메시지 생성',
    description: '후보별 추천 근거와 캠페인 조건을 친근하고 답변하기 쉬운 제안 메시지로 만듭니다.',
    systemPrompt: '실제 콘텐츠를 확인한 듯한 구체적인 칭찬과 답변하기 쉬운 질문을 포함합니다.',
    rules: '과장, 압박, 복붙투 문장을 피하고 광고 표기 안내를 자연스럽게 포함합니다.',
  },
  'reference-analysis': {
    name: '레퍼런스 분석',
    description: '저장한 콘텐츠에서 재사용할 후킹 구조, 장면, CTA를 추출합니다.',
    systemPrompt: '원문을 복제하지 않고 구조와 정보 배열만 분석해 새 캠페인에 맞게 변형합니다.',
    rules: '분석 대상은 사용자가 저장한 콘텐츠로 제한하며, 분석은 저장 이후 명시적으로 실행합니다.',
  },
}

const driveFile = (folderKey, id, name, modifiedAt) => ({
  folderKey,
  id,
  name,
  modifiedAt,
  sourceUrl: `https://drive.google.com/file/d/${id}/view`,
  downloadUrl: `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`,
})

export const CREATOROPS_COMMON_LEARNING_SOURCES = [
  driveFile('common', '1ComEUtSsBAo7V2C_SEGSfKydLfskCcio', 'A09_스키마.json', '2026-09-01T13:47:57.972Z'),
  driveFile('common', '1xOhmpaGuTt9t9Vi0LdLjMaixja25lyfM', 'A01_브랜드_시장프로파일.xlsx', '2026-09-01T11:21:43.955Z'),
  driveFile('common', '1x5ZfX2fzHbz7RthRrJFDWQWy7DHHi0GJ', '00_공통레이어_전기능공통.txt', '2026-09-01T11:07:22.963Z'),
]

export const CREATOROPS_FEATURE_LEARNING_SOURCES = {
  'creator-recommendation': [
    driveFile('creator-recommendation', '1vNDgwqXLk7fN5POBneq9hNutYCcr2SV-', 'A08_데이터수집_위치맵.xlsx', '2026-09-01T13:46:56.420Z'),
    driveFile('creator-recommendation', '1HXCe1EuxZeijr2xKQDE-bQwCJnDT46z_', 'A02_캐스팅유형_티어_추천규칙.xlsx', '2026-09-01T11:35:08.160Z'),
    driveFile('creator-recommendation', '16FkOKg6YpQCbkXoYyUYQsJNJaRHzaRNS', '01_AI인플루언서추천.txt', '2026-09-01T11:07:46.807Z'),
  ],
  'campaign-strategy': [
    driveFile('campaign-strategy', '1_LDGi6loKAanKp1isxPUNSCXmK5i0R_G', 'A07_레퍼런스_위닝_댓글_스키마.xlsx', '2026-09-01T13:37:04.529Z'),
    driveFile('campaign-strategy', '1t3JOOCz7Nz81avhQyONf5_9hvlgPQ6pZ', 'A04_전략_프레임워크.xlsx', '2026-09-01T12:35:34.090Z'),
    driveFile('campaign-strategy', '1lHd99Esr52NNyMzgwEjUaR6jf5cTjYyz', 'A03_표시규정_금지표현.xlsx', '2026-09-01T12:23:57.345Z'),
    driveFile('campaign-strategy', '1PAEzticNta1TbWMmq7WFU0uJP4hGCOUn', '02_캠페인전략생성.txt', '2026-09-01T11:08:19.616Z'),
  ],
  'content-guide': [
    driveFile('content-guide', '18lv5e7jm-8dHk9_cbvIMMgQ6npgYQWTo', 'A08_데이터수집_위치맵.xlsx', '2026-09-01T13:47:03.615Z'),
    driveFile('content-guide', '1A94qNCAGcxC5ujng4ZpmUdJv4HzUdnnJ', 'A07_레퍼런스_위닝_댓글_스키마.xlsx', '2026-09-01T13:37:09.503Z'),
    driveFile('content-guide', '14uOLQrSEtRHPUZTH6gw2rhRUW8ykItFk', 'A05_가이드_템플릿.xlsx', '2026-09-01T12:47:44.728Z'),
    driveFile('content-guide', '1Ha3c8R1VlD8Vh8RIQWJp6J7RJAbqmHTV', 'A03_표시규정_금지표현.xlsx', '2026-09-01T12:24:02.723Z'),
    driveFile('content-guide', '19Xoyj0IQxwuOSwd_iJ5jMzPJTS9DLv-2', '03_인플루언서가이드생성.txt', '2026-09-01T11:08:51.651Z'),
  ],
  'outreach-message': [
    driveFile('outreach-message', '1XXlu8Qa87mFow6nVZXKDJndUvrk6Me8s', 'A06_제안메시지_템플릿.xlsx', '2026-09-01T13:13:19.176Z'),
    driveFile('outreach-message', '1dMDe62NWmK7A5V_kLICjFxhjnI99yLhx', 'A03_표시규정_금지표현.xlsx', '2026-09-01T12:24:07.430Z'),
    driveFile('outreach-message', '1hQlS6NiscZCOGfRcvybCJpvtPwT1nDU6', '04_제안메시지생성.txt', '2026-09-01T11:09:13.078Z'),
  ],
  'reference-analysis': [
    driveFile('reference-analysis', '1kY5wDHvjn5Z60SOHxUXfMUffv3dw9cte', 'A08_데이터수집_위치맵.xlsx', '2026-09-01T13:47:09.016Z'),
    driveFile('reference-analysis', '1QgizQZxUv28pg0Eun72F-qGogftBw95A', 'A07_레퍼런스_위닝_댓글_스키마.xlsx', '2026-09-01T13:35:49.077Z'),
    driveFile('reference-analysis', '1G42HatcSg1Je8VmDZyA9yx-Y_Bo58uEk', 'A02_캐스팅유형_티어_추천규칙.xlsx', '2026-09-01T11:35:28.659Z'),
    driveFile('reference-analysis', '1aPpgodR7Lrw7jTrWCqhyrbOBg1oqCM46', '05_레퍼런스분석.txt', '2026-09-01T11:09:41.185Z'),
  ],
}

export function getCreatorOpsLearningSources(featureKey) {
  return [...CREATOROPS_COMMON_LEARNING_SOURCES, ...(CREATOROPS_FEATURE_LEARNING_SOURCES[featureKey] || [])]
}
