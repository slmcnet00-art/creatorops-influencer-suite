# API Connection Check - CreatorOps Influencer CRM

## Current Status

- Frontend production build: OK
- Node API syntax check: OK
- Local API health check: OK
- Production API health check: OK

The app is ready for credential-level API testing. The implementation already has a server-side API proxy, so real secrets should be stored in the API service environment, not in the browser.

## Implemented API Surface

- `GET /health`
- `GET /readiness`
- `GET /readiness?probe=live`
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

Safe production diagnostics:

```text
GET http://127.0.0.1:8792/readiness?probe=live
```

This route uses read-only provider requests for YouTube, the profile-search provider actually selected by production (Brave Search when configured, otherwise Google Search/CX), the configured OpenAI model, and the 14 Supabase data-room tables. Gmail is configuration-only: it reports `authorization_required` until the current browser completes OAuth. The diagnostic never generates AI content, writes data, exchanges an OAuth code, or sends email, and its response never includes credential values. Live results are cached in the API process for five minutes by default so repeated dashboard refreshes do not waste provider quota.

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
- API `/readiness?probe=live` confirms the read-only safety contract
- YouTube, the active profile-search provider, OpenAI model access, and Supabase table reads are reported independently
- Gmail reports backend OAuth configuration separately from browser user authorization; no email is sent

## Test Order

1. Fill server environment variables on the API service.
2. Confirm `GET /health`, then run `GET /readiness?probe=live`.
3. Test YouTube channel lookup with a known public channel.
4. Test YouTube discovery search with a narrow Korean query.
5. Test `/references/search` with `platform=YouTube`.
6. Add `BRAVE_SEARCH_API_KEY`, then test `/references/search` with `platform=Instagram`, `platform=TikTok`, and `platform=all`.
7. Test Google profile discovery only if the Google Custom Search project has legacy access.
8. Test OpenAI outreach message generation.
9. Confirm Gmail reports `authorization_required`, then complete OAuth only when a real user is ready to connect their account. Sending is not part of the readiness check.
10. Enable Supabase workspace sync after API discovery is stable.

## Media API Notes

- YouTube: official Data API is used for reference search, creator discovery, channel stats, and video performance.
- Instagram/TikTok reference search: Brave Search API is used for public URL discovery, then public snapshot enrichment is attempted. Hidden platform metrics remain blank unless the platform exposes them publicly or a creator/API authorization path is added.
- Instagram official path: Meta Instagram Graph API hashtag search can support public hashtag media for approved business/creator accounts, but it is not a full arbitrary competitor database.
- TikTok official path: TikTok Research API can query public videos/accounts for eligible approved researchers. It is not a general commercial discovery API for every advertiser account.
- Google Ads Transparency Center: Google does not currently expose a general official API for the transparency center; use a third-party provider only if its terms are acceptable.

## Operating Rule

Start with read/discovery and draft message generation. Do not automate Instagram or TikTok DM sending in beta. Use email outreach only after OAuth, unsubscribe handling, duplicate-send prevention, and send logs are confirmed.
