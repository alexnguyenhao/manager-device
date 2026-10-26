/* Harness kiểm thử UI: chạy renderer đã build trong trình duyệt headless,
   gọi thẳng các IPC handler của main process qua HTTP. Chỉ dùng khi phát triển. */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { openDatabase } from '../src/main/db/database'
import { registerIpcHandlers } from '../src/main/ipc'
import { ipcHandlers } from './electron-stub'

const PORT = Number(process.env.MD_UI_PORT || 5199)
const ROOT = process.env.MD_RENDERER_DIR || join(process.cwd(), 'out/renderer')

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.map': 'application/json'
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

async function handleRpc(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readBody(req)
  let payload: { channel?: string; args?: unknown[] }
  try {
    payload = JSON.parse(body) as { channel?: string; args?: unknown[] }
  } catch {
    sendJson(res, 400, { ok: false, error: { message: 'JSON không hợp lệ', code: 'BAD_REQUEST' } })
    return
  }
  const handler = payload.channel ? ipcHandlers.get(payload.channel) : undefined
  if (!handler) {
    sendJson(res, 404, {
      ok: false,
      error: { message: `Không có IPC handler: ${payload.channel}`, code: 'NOT_FOUND' }
    })
    return
  }
  try {
    const result = await handler({}, ...(payload.args ?? []))
    sendJson(res, 200, result)
  } catch (error) {
    console.error('[UI HARNESS]', payload.channel, error)
    sendJson(res, 500, {
      ok: false,
      error: { message: (error as Error).message, code: 'INTERNAL' }
    })
  }
}

async function handleStatic(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const requested = url.pathname === '/' ? '/index.html' : url.pathname
  const file = normalize(join(ROOT, decodeURIComponent(requested)))
  if (!file.startsWith(ROOT)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }
  try {
    const content = await readFile(file)
    res.writeHead(200, {
      'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'no-store'
    })
    res.end(content)
  } catch {
    // SPA fallback
    const index = await readFile(join(ROOT, 'index.html'))
    res.writeHead(200, { 'content-type': MIME['.html'] })
    res.end(index)
  }
}

openDatabase()
registerIpcHandlers()

const server = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/rpc') {
    void handleRpc(req, res)
    return
  }
  void handleStatic(req, res)
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`UI harness listening on http://127.0.0.1:${PORT} (handlers: ${ipcHandlers.size})`)
})
