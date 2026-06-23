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
- `POST /references/search`
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
- `BRAVE_SEARCH_API_KEY`
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
- `/references/search` returns `BRAVE_SEARCH_API_KEY is not configured.` when Instagram/TikTok reference search is requested without Brave Search.
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
5. Test `/references/search` with `platform=YouTube`.
6. Add `BRAVE_SEARCH_API_KEY`, then test `/references/search` with `platform=Instagram`, `platform=TikTok`, and `platform=all`.
7. Test Google profile discovery only if the Google Custom Search project has legacy access.
8. Test OpenAI outreach message generation.
9. Test Gmail OAuth auth URL, then token exchange, then one internal test send.
10. Enable Supabase workspace sync after API discovery is stable.

## Media API Notes

- YouTube: official Data API is used for reference search, creator discovery, channel stats, and video performance.
- Instagram/TikTok reference search: Brave Search API is used for public URL discovery, then public snapshot enrichment is attempted. Hidden platform metrics remain blank unless the platform exposes them publicly or a creator/API authorization path is added.
- Instagram official path: Meta Instagram Graph API hashtag search can support public hashtag media for approved business/creator accounts, but it is not a full arbitrary competitor database.
- TikTok official path: TikTok Research API can query public videos/accounts for eligible approved researchers. It is not a general commercial discovery API for every advertiser account.
- Google Ads Transparency Center: Google does not currently expose a general official API for the transparency center; use a third-party provider only if its terms are acceptable.

## Operating Rule

Start with read/discovery and draft message generation. Do not automate Instagram or TikTok DM sending in beta. Use email outreach only after OAuth, unsubscribe handling, duplicate-send prevention, and send logs are confirmed.
