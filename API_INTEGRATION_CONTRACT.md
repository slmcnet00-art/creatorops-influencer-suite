# CreatorOps API Integration Contract

현재 프론트는 Supabase 공유 저장소와 별도 API 프록시를 옵션으로 지원합니다.
운영 배포에서는 API 키를 브라우저에 두지 말고 `VITE_CREATOROPS_API_BASE_URL` 뒤 서버에 보관합니다.

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

## Production Priority

1. Supabase Auth와 `workspace_snapshots` 저장소를 먼저 연결합니다.
2. API 서버에서 YouTube/Google/OpenAI/Gmail 키를 보관합니다.
3. Instagram/TikTok은 공식 OAuth 또는 공개 프로필 URL 수집 + 수동 검증 원장으로 운영합니다.
4. 메시지 자동 발송은 공개 협업 이메일 기반으로 시작하고, DM은 복사/승인형 보조 채널로 둡니다.
