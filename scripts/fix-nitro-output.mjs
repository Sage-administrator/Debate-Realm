// scripts/fix-nitro-output.mjs
//
// 生产构建（npm run release / npm run start）的兼容补丁。在 `nuxt build` 之后、
// `node start.mjs` 之前运行（见 package.json 的 release/start 脚本）。
//
// 修复两类已知构建问题：
//   1. @libsql 原生二进制（约 8.8MB 的 index.node）不会被 Nitro 的静态
//      依赖扫描复制进 .output（因为它由 libsql 以 `require('@libsql/${target}')` 动态拼接
//      路径加载，Nitro 抓不到）。不补 -> 启动报 Cannot find module '@libsql/<platform>'。
//   2. Nitro 在 ESM import hoisting 阶段用 `file:///_entry.js`（Windows 上缺盘符）作为
//      _importMeta_ 的 fallback，导致启动时 file:///_entry.js 找不到文件。补为真实绝对路径。
//      Linux/Docker 不受影响（file:/// 已是合法根路径），自动跳过。
//
// 幂等：原生模块始终覆盖（保证版本一致），缺源则 warn 跳过；_entry.js 仅在匹配到字面量时替换。

import {
  existsSync,
  mkdirSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
} from 'node:fs'
import { join, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import os from 'node:os'

const cwd = process.cwd()

// 与 nuxt.config.ts 的 buildRoot 一致：
//   BUILD_IN_PLACE=true → 项目内 .build/ 目录
//   否则 → 系统临时目录（Windows WorkBuddy 兼容）
const buildRoot = process.env.BUILD_IN_PLACE === 'true'
  ? join(cwd, '.build')
  : join(os.tmpdir(), 'debate-timer-build')
const prodOutput = join(buildRoot, 'output')
const projOutput = join(cwd, '.output')

// 与 start.mjs 保持同一套目录探测逻辑：优先 production 输出，回退项目根 .output
function pickOutputDir() {
  if (existsSync(join(prodOutput, 'server', 'index.mjs'))) return prodOutput
  if (existsSync(join(projOutput, 'server', 'index.mjs'))) return projOutput
  if (existsSync(join(prodOutput, 'server'))) return prodOutput
  if (existsSync(join(projOutput, 'server'))) return projOutput
  return prodOutput
}

const outputDir = pickOutputDir()
const serverDir = join(outputDir, 'server')
console.log(`[fix-nitro-output] 构建根目录: ${buildRoot}`)
console.log(`[fix-nitro-output] 目标输出目录: ${outputDir}`)

if (!existsSync(serverDir)) {
  console.warn('[fix-nitro-output] ⚠️ 未找到 .output/server，请先运行 nuxt build。跳过修复。')
  process.exit(0)
}

// ---- 1. 复制 @libsql 原生模块 ----
// 平台感知：Windows → win32-x64-msvc, Linux x64 → linux-x64-gnu, Linux ARM → linux-arm64-gnu
let platformTarget
if (process.platform === 'win32') {
  platformTarget = 'win32-x64-msvc'
} else if (process.arch === 'arm64') {
  platformTarget = 'linux-arm64-gnu'
} else {
  platformTarget = 'linux-x64-gnu'
}

const libsqlSrc = join(cwd, 'node_modules', '@libsql', platformTarget, 'index.node')
const libsqlTargets = [
  join(serverDir, 'node_modules', '@libsql', platformTarget, 'index.node'),
  join(serverDir, 'node_modules', 'libsql', platformTarget, 'index.node'),
]
if (existsSync(libsqlSrc)) {
  for (const t of libsqlTargets) {
    mkdirSync(dirname(t), { recursive: true })
    copyFileSync(libsqlSrc, t)
    console.log(`[fix-nitro-output] ✓ 已确保原生模块存在 (${platformTarget}) -> ${t}`)
  }
} else {
  console.warn(
    `[fix-nitro-output] ⚠️ 源原生模块缺失: ${libsqlSrc}（当前平台 ${platformTarget} 依赖未安装？跳过）`
  )
}

// ---- 2. 修复 file:///_entry.js 缺盘符（仅 Windows 需要） ----
if (process.platform === 'win32') {
  const correctUrl = pathToFileURL(join(serverDir, '_entry.js')).href
  let fixedCount = 0
  function walkFix(dir) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) {
        walkFix(p)
        continue
      }
      if (!p.endsWith('.mjs')) continue
      const s = readFileSync(p, 'utf8')
      if (s.includes('file:///_entry.js')) {
        writeFileSync(p, s.split('file:///_entry.js').join(correctUrl))
        fixedCount++
        console.log(`[fix-nitro-output] ✓ 修复 _entry.js 路径 -> ${p}`)
      }
    }
  }
  walkFix(serverDir)
  if (fixedCount === 0) {
    console.log('[fix-nitro-output] ℹ️ 未发现需修复的 file:///_entry.js（当前构建未触发该问题）')
  }
} else {
  console.log('[fix-nitro-output] ℹ️ 非 Windows 平台，跳过 file:///_entry.js 修复')
}

console.log('[fix-nitro-output] 完成。')
