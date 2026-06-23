# API Connection Check - CreatorOps Influencer CRM

## Current Status

- Frontend production build: OK
- Node API syntax check: OK
- Local API health check: OK
- Production API health check: OK

The app is ready for credential-level API testing. The implementation already has a server-side API proxy, so real secrets should be stored in the API service environment, not in the browser.

## Implemented API Surface

- `GET /health`
- `POST /youtube/channel`
- `POST /discovery/youtube/search`
- `POST /discovery/google-profiles/search`
- `POST /ai/outreach-message`
- `POST /ai/content-guide`
- `POST /public/profile-snapshot`
- `POST /tracking/refresh`
- `GET /oauth/google/auth-url`
- `GET /oauth/google/callback`
- `POST /oauth/google/token`
- `POST /outreach/gmail/send`

## Required Secrets

Core backend:

- `VITE_CREATOROPS_API_BASE_URL`
- `PORT`
- `CORS_ORIGIN`
- `FRONTEND_URL`

Data and discovery:

- `YOUTUBE_DATA_API_KEY`
- `GOOGLE_SEARCH_API_KEY`
- `GOOGLE_SEARCH_CX`
- `PUBLIC_SNAPSHOT_ENABLED`
- `PUBLIC_SNAPSHOT_TIMEOUT_MS`

AI:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`

Outreach:

- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`

Workspace:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_WORKSPACE_ID`

## Verified Tests

Local:

```powershell
cd "<cloned-repo-folder>"
$env:PORT="8792"
node server/index.js
```

Then:

```text
GET http://127.0.0.1:8792/health
```

Expected:

```json
{"ok":true,"service":"creatorops-api","version":"local"}
```

Missing-key behavior is correct:

- `/youtube/channel` returns `YOUTUBE_DATA_API_KEY is not configured.`
- `/discovery/google-profiles/search` returns `GOOGLE_SEARCH_API_KEY is not configured.`
- `/ai/outreach-message` returns `OPENAI_API_KEY is not configured.`
- `/oauth/google/auth-url` returns `GMAIL_CLIENT_ID is not configured.`

Production check:

```powershell
npm run production:check
```

Verified:

- Frontend 200
- API `/health` 200
- YouTube discovery contract returns 501 until key is configured
- AI message contract returns 501 until key is configured

## Test Order

1. Fill server environment variables on the API service.
2. Confirm `GET /health`.
3. Test YouTube channel lookup with a known public channel.
4. Test YouTube discovery search with a narrow Korean query.
5. Test Google profile discovery for Instagram and TikTok URLs.
6. Test OpenAI outreach message generation.
7. Test Gmail OAuth auth URL, then token exchange, then one internal test send.
8. Enable Supabase workspace sync after API discovery is stable.

## Operating Rule

Start with read/discovery and draft message generation. Do not automate Instagram or TikTok DM sending in beta. Use email outreach only after OAuth, unsubscribe handling, duplicate-send prevention, and send logs are confirmed.
