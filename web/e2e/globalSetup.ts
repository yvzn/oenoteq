import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const webDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = resolve(webDir, '..')
const embedDir = join(repoRoot, 'internal', 'static', 'dist')
const exeName = process.platform === 'win32' ? 'cellar-e2e.exe' : 'cellar-e2e'

function freePort(): Promise<number> {
  return new Promise((res, rej) => {
    const srv = createServer()
    srv.once('error', rej)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as { port: number }
      srv.close(() => res(port))
    })
  })
}

// The exe embeds internal/static/dist (a tracked placeholder). Swap in the
// freshly built SPA for the Go build only, then put the placeholder back so
// the working tree stays clean.
function buildExe(exePath: string): void {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  execFileSync(npm, ['run', 'build'], { cwd: webDir, stdio: 'inherit', shell: process.platform === 'win32' })

  try {
    rmSync(embedDir, { recursive: true, force: true })
    cpSync(join(webDir, 'dist'), embedDir, { recursive: true })
    execFileSync('go', ['build', '-o', exePath, '.'], { cwd: repoRoot, stdio: 'inherit' })
  } finally {
    rmSync(embedDir, { recursive: true, force: true })
    execFileSync('git', ['checkout', '--', 'internal/static/dist'], { cwd: repoRoot, stdio: 'inherit' })
  }
}

async function waitForHealth(baseUrl: string, server: ChildProcess): Promise<void> {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`exe exited early with code ${server.exitCode}`)
    try {
      if ((await fetch(`${baseUrl}/health`)).ok) return
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error('exe did not answer /health within 30s')
}

async function post(baseUrl: string, path: string, body: unknown): Promise<void> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`seed POST ${path} failed: ${res.status} ${await res.text()}`)
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  const workDir = mkdtempSync(join(tmpdir(), 'cellar-e2e-'))
  const exePath = join(workDir, exeName)
  buildExe(exePath)

  const port = await freePort()
  const baseUrl = `http://127.0.0.1:${port}`
  const server = spawn(exePath, [], {
    env: { ...process.env, PORT: String(port), DB_PATH: join(workDir, 'cellar.db') },
    stdio: 'inherit',
  })

  const cleanup = async () => {
    if (server.exitCode === null) {
      const exited = new Promise((r) => server.once('exit', r))
      server.kill()
      await exited
    }
    rmSync(workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }

  try {
    await waitForHealth(baseUrl, server)
    await post(baseUrl, '/producers', { name: 'Domaine du Closel' })
    await post(baseUrl, '/appellations', { name: 'Savennières' })
  } catch (err) {
    await cleanup()
    throw err
  }

  process.env.E2E_BASE_URL = baseUrl
  return cleanup
}

