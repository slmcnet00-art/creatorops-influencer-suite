# CreatorOps API Integration Contract

현재 프론트는 Supabase 공유 저장소와 별도 API 프록시를 옵션으로 지원합니다.
운영 배포에서는 API 키를 브라우저에 두지 말고 `VITE_CREATOROPS_API_BASE_URL` 뒤 서버에 보관합니다.

이 저장소에는 `server/index.js`에 Node/Express API 서버가 포함되어 있습니다. 로컬에서는 아래처럼 실행합니다.

```bash
npm run api:dev
```

## Frontend Environment

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_WORKSPACE_ID=miping-main
VITE_CREATOROPS_API_BASE_URL=https://your-creatorops-api.onrender.com
```

## Required Server Secrets

```env
YOUTUBE_DATA_API_KEY=
GOOGLE_SEARCH_API_KEY=
GOOGLE_SEARCH_CX=
OPENAI_API_KEY=
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
```

## Endpoints

### GET `/health`

Response:

```json
{ "ok": true, "service": "creatorops-api", "version": "local" }
```

### POST `/youtube/channel`

Request:

```json
{ "lookup": "@handle-or-channel-id" }
```

Response:

```json
{
  "data": {
    "channelId": "UC...",
    "name": "Creator",
    "handle": "@creator",
    "avatar": "https://...",
    "followers": 120000,
    "averageViews": 45000,
    "totalViews": 3500000,
    "videoCount": 80,
    "description": "Public channel description",
    "country": "KR",
    "source": "YouTube Data API"
  }
}
```

### POST `/discovery/youtube/search`

Request:

```json
{ "query": "pet kennel creator Korea", "maxResults": 8 }
```

Response:

```json
{
  "data": [
    {
      "id": "UC...",
      "platform": "YouTube",
      "name": "Creator",
      "handle": "@creator",
      "profileUrl": "https://www.youtube.com/@creator",
      "avatar": "https://...",
      "followers": 120000,
      "averageViews": 45000,
      "totalViews": 3500000,
      "videoCount": 80,
      "description": "Public channel description",
      "country": "KR",
      "source": "YouTube Data API",
      "verifiedMetrics": true
    }
  ]
}
```

### POST `/discovery/google-profiles/search`

Request:

```json
{ "query": "pet influencer kennel", "platform": "TikTok", "maxResults": 8 }
```

Response:

```json
{
  "data": [
    {
      "id": "TikTok:@creator",
      "platform": "TikTok",
      "name": "Creator",
      "handle": "@creator",
      "profileUrl": "https://www.tiktok.com/@creator",
      "snippet": "Public search snippet",
      "source": "Google Programmable Search",
      "verifiedMetrics": false
    }
  ]
}
```

### POST `/ai/outreach-message`

OpenAI API로 친근한 섭외 제안 메시지를 생성합니다.

Request:

```json
{
  "creator": { "name": "Creator", "platform": "TikTok" },
  "brand": { "brandName": "Brand", "product": "Product" },
  "campaign": { "name": "Campaign", "reward": "paid" }
}
```

Response:

```json
{ "data": { "message": "안녕하세요..." } }
```

### POST `/ai/content-guide`

OpenAI API로 무가시딩, 유가시딩, 공동구매 셀러 등 유형에 맞춘 콘텐츠 가이드를 생성합니다.

Request:

```json
{
  "brand": { "brandName": "Brand", "product": "Product" },
  "campaign": { "name": "Campaign", "oneMessage": "Core message" },
  "seedingType": "유가시딩",
  "channel": "TikTok",
  "references": []
}
```

Response:

```json
{ "data": { "guide": "# 콘텐츠 가이드..." } }
```

### POST `/outreach/gmail/send`

Gmail 발송용 예약 엔드포인트입니다. 현재는 OAuth 토큰 저장소가 없으면 `501`을 반환합니다.
실제 자동 발송은 사용자별 OAuth 동의, 수신 거부, 중복 발송 방지, 발송량 제한 로그가 연결된 뒤 활성화합니다.

## Production Priority

1. Supabase Auth와 `workspace_snapshots` 저장소를 먼저 연결합니다.
2. API 서버에서 YouTube/Google/OpenAI/Gmail 키를 보관합니다.
3. Instagram/TikTok은 공식 OAuth 또는 공개 프로필 URL 수집 + 수동 검증 원장으로 운영합니다.
4. 메시지 자동 발송은 공개 협업 이메일 기반으로 시작하고, DM은 복사/승인형 보조 채널로 둡니다.
