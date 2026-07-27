import { spawn } from 'node:child_process'
import { join } from 'node:path'
import os from 'node:os'

// 构建产物被路由到系统临时目录（见 nuxt.config.ts 的 buildRoot），
// 因此启动服务器需从临时目录的 .output/server/index.mjs 拉起。
const port = process.env.PORT || process.env.NITRO_PORT || '3000'
const entry = join(os.tmpdir(), 'debate-timer-build', 'output', 'server', 'index.mjs')

const child = spawn(process.execPath, [entry], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: { ...process.env, PORT: String(port), NITRO_PORT: String(port) },
})

child.on('exit', (code) => process.exit(code ?? 0))
