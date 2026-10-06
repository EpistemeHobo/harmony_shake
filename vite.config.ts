import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Dev-only endpoint that lets the app write captured item icons into public/icons/.
 * GET  /__api/icons            -> { ok: true }   (lets the app know the endpoint exists)
 * POST /__api/icons {icons:{id:dataURL}} -> writes public/icons/<id>.png, updates data/codex_icons.json,
 *                                            and regenerates src/seed.ts.
 * Only runs under `npm run dev` on your own machine; a static build has no such endpoint.
 */
function iconWriter(): Plugin {
  const root = process.cwd()
  const iconDir = resolve(root, 'public/icons')
  const manifestPath = resolve(root, 'data/codex_icons.json')
  const MAX_BYTES = 200_000

  return {
    name: 'harmony-shake-icon-writer',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__api/icons', (req, res) => {
        const send = (status: number, body: unknown) => {
          res.statusCode = status
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(body))
        }
        // Only this machine, only this page: block other devices on the network and cross-site requests
        // (a website you visit can't make your running dev server write files).
        const ip = req.socket.remoteAddress ?? ''
        if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip)) return send(403, { error: 'local only' })
        const host = req.headers.host ?? ''
        const origin = req.headers.origin
        if (origin && new URL(origin).host !== host) return send(403, { error: 'cross-origin request blocked' })
        if (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(String(req.headers['sec-fetch-site']))) return send(403, { error: 'cross-site request blocked' })
        if (req.method === 'GET') return send(200, { ok: true })
        if (req.method !== 'POST') return send(405, { error: 'method not allowed' })
        // JSON content type forces a CORS preflight for cross-origin callers, which this server never approves.
        if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) return send(415, { error: 'JSON only' })
        let raw = ''
        req.on('data', (chunk) => {
          raw += chunk
          if (raw.length > 20_000_000) req.destroy()
        })
        req.on('end', () => {
          try {
            const { icons } = JSON.parse(raw) as { icons: Record<string, string> }
            const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {}
            const written: string[] = []
            for (const [id, url] of Object.entries(icons ?? {})) {
              if (!/^[a-z0-9-]+$/.test(id)) continue // item ids only: no paths
              if (typeof url !== 'string' || !url.startsWith('data:image/png;base64,')) continue
              const bytes = Buffer.from(url.slice('data:image/png;base64,'.length), 'base64')
              if (!bytes.length || bytes.length > MAX_BYTES) continue
              writeFileSync(resolve(iconDir, `${id}.png`), bytes)
              const old = manifest[id]?.file as string | undefined
              if (old && old !== `/icons/${id}.png` && /^\/icons\/[a-z0-9-]+\.\w+$/.test(old)) {
                const oldPath = resolve(root, 'public', old.slice(1))
                if (existsSync(oldPath)) unlinkSync(oldPath)
              }
              manifest[id] = { ...(manifest[id] ?? {}), file: `/icons/${id}.png`, source: 'capture' }
              written.push(id)
            }
            writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
            // Regenerate the seed so the new icons become the project defaults.
            let seed = 'skipped'
            if (written.length) {
              const py = ['python', 'py', 'python3'].find((cmd) => spawnSync(cmd, ['--version']).status === 0)
              seed = py && spawnSync(py, ['scripts/build_seed.py'], { cwd: root, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }).status === 0 ? 'ok' : 'failed'
            }
            send(200, { written, seed })
          } catch (e) {
            send(400, { error: (e as Error).message })
          }
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), iconWriter()],
})
