# Render Environment Sync

This project can sync CreatorOps API credentials to Render through the Render API.

## Why This Exists

Secret values should not be committed to GitHub or `render.yaml`.

Use this workflow to keep secrets in a local ignored file and push them directly to Render.

## Prerequisites

1. Create a Render API key from Render Dashboard > Account Settings > API Keys.
2. Copy `.render-env.example` to `.render-env.local`.
3. Fill `.render-env.local` with the values from the private credential sheet.

`.render-env.local` is ignored by Git because `.gitignore` already ignores `*.local`.

## Run

```powershell
npm run render:sync-env
```

The script finds these Render services by name:

- `creatorops-suite-api`
- `creatorops-influencer-suite`

Override names if needed:

```powershell
$env:RENDER_API_SERVICE_NAME="creatorops-suite-api"
$env:RENDER_STATIC_SERVICE_NAME="creatorops-influencer-suite"
npm run render:sync-env
```

## Backend Variables

- `YOUTUBE_DATA_API_KEY`
- `GOOGLE_SEARCH_API_KEY`
- `GOOGLE_SEARCH_CX`
- `PUBLIC_SNAPSHOT_ENABLED`
- `PUBLIC_SNAPSHOT_TIMEOUT_MS`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `CRON_SECRET`

## Frontend Variables

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_WORKSPACE_ID`
- `VITE_CREATOROPS_API_BASE_URL`

## After Sync

Redeploy the API and frontend services in Render, then run:

```powershell
npm run production:check
```
