const apiKey = process.env.RENDER_API_KEY
const ownerId = process.env.RENDER_OWNER_ID
const repoUrl = process.env.RENDER_REPO_URL || 'https://github.com/slmcnet00-art/creatorops-influencer-suite'
const branch = process.env.RENDER_BRANCH || 'master'

if (!apiKey || !ownerId) {
  console.error('RENDER_API_KEY and RENDER_OWNER_ID are required.')
  console.error('Set them temporarily, then run: npm run render:create-api')
  process.exit(1)
}

const servicePayload = {
  type: 'web_service',
  name: process.env.RENDER_API_SERVICE_NAME || 'creatorops-api',
  ownerId,
  repo: repoUrl,
  branch,
  runtime: 'node',
  buildCommand: 'npm install',
  startCommand: 'npm run api:dev',
  plan: process.env.RENDER_PLAN || 'starter',
  envVars: [
    { key: 'NODE_VERSION', value: '22' },
    {
      key: 'CORS_ORIGIN',
      value: process.env.CORS_ORIGIN || 'https://creatorops-influencer-suite.onrender.com,http://localhost:5173,http://127.0.0.1:5173',
    },
    { key: 'YOUTUBE_DATA_API_KEY', value: process.env.YOUTUBE_DATA_API_KEY || '' },
    { key: 'GOOGLE_SEARCH_API_KEY', value: process.env.GOOGLE_SEARCH_API_KEY || '' },
    { key: 'GOOGLE_SEARCH_CX', value: process.env.GOOGLE_SEARCH_CX || '' },
    { key: 'OPENAI_API_KEY', value: process.env.OPENAI_API_KEY || '' },
    { key: 'OPENAI_MODEL', value: process.env.OPENAI_MODEL || 'gpt-4.1-mini' },
  ],
}

const response = await fetch('https://api.render.com/v1/services', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(servicePayload),
})

const payload = await response.json().catch(() => ({}))
if (!response.ok) {
  console.error(JSON.stringify(payload, null, 2))
  process.exit(1)
}

console.log(JSON.stringify(payload, null, 2))
