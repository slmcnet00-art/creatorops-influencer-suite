import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'

const root = join(process.cwd(), 'dist')
const port = Number(process.env.PORT || process.argv[2] || 4175)

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
}

function resolvePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0])
  const safePath = normalize(decoded).replace(/^(\.\.[/\\])+/, '')
  const candidate = join(root, safePath)
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  return join(root, 'index.html')
}

createServer((request, response) => {
  const filePath = resolvePath(request.url || '/')
  const contentType = mimeTypes[extname(filePath)] || 'application/octet-stream'
  response.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000',
  })
  createReadStream(filePath).pipe(response)
}).listen(port, '0.0.0.0', () => {
  console.log(`Static server listening on http://0.0.0.0:${port}`)
})
