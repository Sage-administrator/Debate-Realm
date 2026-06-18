/**
 * QQ Bot WebSocket 连接测试脚本
 * 用法：
 *   方式一（数据库）: node scripts/test-bot-ws.cjs
 *   方式二（环境变量）: $env:QQ_BOT_APP_ID="xxx"; node scripts/test-bot-ws.cjs
 *
 * 测试步骤：
 *   1. 获取 Access Token
 *   2. 获取 Gateway WebSocket 地址
 *   3. 建立 WebSocket 连接
 *   4. 发送 Identify → 等待 READY 事件
 */

const WebSocket = require('ws')

// ── 配置 ──────────────────────────────────────────

const TEAM_MODE = process.env.QQ_BOT_APP_ID ? 'env' : 'db'

// 环境变量方式
const ENV_CONFIG = {
  appId: process.env.QQ_BOT_APP_ID || '',
  appSecret: process.env.QQ_BOT_APP_SECRET || '',
  sandbox: process.env.QQ_BOT_SANDBOX === 'true',
}

// ── 状态 ──────────────────────────────────────────

let accessToken = null
let tokenExpiresAt = 0
let ws = null
let lastSequence = 0
let heartbeatInterval = null
let testStartTime = Date.now()
let testResult = { step1: false, step2: false, step3: false, step4: false }

// ── 辅助 ──────────────────────────────────────────

function log(step, msg, ok) {
  const icon = ok === true ? '✅' : ok === false ? '❌' : 'ℹ️'
  console.log(`${icon} [${step}] ${msg}`)
}

// ── Step 1: Access Token ──────────────────────────

async function step1_getToken(appId, appSecret) {
  console.log('\n━━━ Step 1: 获取 Access Token ━━━')
  try {
    const resp = await fetch('https://bots.qq.com/app/getAppAccessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId, clientSecret: appSecret }),
    })

    if (!resp.ok) {
      const text = await resp.text()
      log('Token', `HTTP ${resp.status}: ${text}`, false)
      return null
    }

    const json = await resp.json()
    accessToken = json.access_token
    tokenExpiresAt = Date.now() + json.expires_in * 1000

    log('Token', `获取成功，有效期 ${json.expires_in} 秒，token 前缀: ${accessToken.substring(0, 10)}...`, true)
    testResult.step1 = true
    return accessToken
  } catch (err) {
    log('Token', `异常: ${err.message}`, false)
    return null
  }
}

// ── Step 2: Gateway URL ───────────────────────────

async function step2_getGateway() {
  console.log('\n━━━ Step 2: 获取 Gateway URL ━━━')
  try {
    const resp = await fetch('https://api.sgroup.qq.com/gateway', {
      headers: { Authorization: `QQBot ${accessToken}` },
    })

    if (!resp.ok) {
      const text = await resp.text()
      log('Gateway', `HTTP ${resp.status}: ${text}`, false)
      return null
    }

    const json = await resp.json()
    const url = json.url
    log('Gateway', `获取成功: ${url}`, true)
    testResult.step2 = true
    return url
  } catch (err) {
    log('Gateway', `异常: ${err.message}`, false)
    return null
  }
}

// ── Step 3 & 4: WebSocket 连接 ────────────────────

function step3_connectWs(gatewayUrl, appId, appSecret) {
  console.log('\n━━━ Step 3: 连接 WebSocket ━━━')

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (!testResult.step4) {
        log('WS', '超时（30秒未收到 READY）', false)
        if (ws) ws.close()
        resolve()
      }
    }, 30000)

    ws = new WebSocket(gatewayUrl)

    ws.on('open', () => {
      log('WS', 'TCP 连接已建立', true)
      testResult.step3 = true
    })

    ws.on('message', (data) => {
      try {
        const payload = JSON.parse(data.toString())
        const { op, d, s, t } = payload

        if (s !== undefined) lastSequence = s

        switch (op) {
          case 10: // Hello
            const interval = d.heartbeat_interval
            log('WS', `收到 Hello, 心跳间隔: ${interval}ms`, true)

            // 启动心跳
            heartbeatInterval = setInterval(() => {
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ op: 1, d: lastSequence }))
              }
            }, interval)

            // 计算 Intents: PUBLIC_GUILD_MESSAGES + GROUP_AND_C2C_EVENT
            const intents = (1 << 30) | (1 << 25)

            // 发送 Identify
            console.log('\n━━━ Step 4: 发送 Identify ━━━')
            const identifyPayload = {
              op: 2,
              d: {
                token: `QQBot ${accessToken}`,
                intents,
                shard: [0, 1],
                properties: { os: 'windows', browser: 'nodejs', device: 'nodejs' },
              },
            }
            ws.send(JSON.stringify(identifyPayload))
            log('Identify', '已发送, 等待 READY 事件...')
            break

          case 11: // Heartbeat ACK
            // 静默
            break

          case 0: // Dispatch
            if (t === 'READY') {
              const elapsed = ((Date.now() - testStartTime) / 1000).toFixed(1)
              log('READY', `连接就绪！Session: ${d.session_id}, 耗时: ${elapsed}秒`, true)
              log('READY', `Bot 名称: ${d.user?.username}, ID: ${d.user?.id}`, true)
              testResult.step4 = true
              clearTimeout(timeout)
              setTimeout(() => {
                cleanup()
                resolve()
              }, 1000)
            } else {
              console.log(`   [Dispatch] 事件: ${t}`)
            }
            break

          case 7:
            log('WS', '服务端要求重连', false)
            break

          case 9:
            log('WS', 'Session 无效', false)
            clearTimeout(timeout)
            cleanup()
            resolve()
            break

          default:
            console.log(`   [OpCode ${op}]`)
        }
      } catch (err) {
        console.error('   解析失败:', err.message)
      }
    })

    ws.on('close', (code) => {
      log('WS', `连接关闭 (code: ${code})`, testResult.step4)
      clearTimeout(timeout)
      cleanup()
      resolve()
    })

    ws.on('error', (err) => {
      log('WS', `错误: ${err.message}`, false)
      if (!testResult.step4) {
        clearTimeout(timeout)
        cleanup()
        resolve()
      }
    })
  })
}

function cleanup() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
    heartbeatInterval = null
  }
  if (ws) {
    ws.close()
    ws = null
  }
}

// ── 数据库方式 ────────────────────────────────────

async function loadFromDatabase() {
  // 注意：Prisma Client 经自定义输出路径生成，独立 Node 脚本无法直接加载
  // 请使用环境变量方式测试，或通过 Nuxt Nitro 服务端加载
  console.log('ℹ️ 数据库方式需通过 Nuxt Nitro 服务端加载，请使用环境变量方式测试')
  return null
}

// ── 主流程 ────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════')
  console.log('  QQ Bot WebSocket 连接测试')
  console.log('═══════════════════════════════════════')

  let credentials

  if (TEAM_MODE === 'env') {
    if (!ENV_CONFIG.appId || !ENV_CONFIG.appSecret) {
      console.log('❌ 请设置环境变量 QQ_BOT_APP_ID 和 QQ_BOT_APP_SECRET')
      console.log('   PowerShell:')
      console.log('   $env:QQ_BOT_APP_ID="你的AppID"')
      console.log('   $env:QQ_BOT_APP_SECRET="你的AppSecret"')
      console.log('   node scripts/test-bot-ws.cjs')
      return
    }
    credentials = ENV_CONFIG
    console.log('📡 使用环境变量中的 Bot 凭证')
  } else {
    credentials = await loadFromDatabase()
    if (!credentials) return
  }

  console.log(`   App ID: ${credentials.appId.substring(0, 6)}****`)
  testStartTime = Date.now()

  // Step 1
  const token = await step1_getToken(credentials.appId, credentials.appSecret)
  if (!token) {
    printSummary()
    return
  }

  // Step 2
  const gatewayUrl = await step2_getGateway()
  if (!gatewayUrl) {
    printSummary()
    return
  }

  // Step 3 & 4
  await step3_connectWs(gatewayUrl, credentials.appId, credentials.appSecret)

  // ── 结果 ──
  printSummary()
}

function printSummary() {
  console.log('\n═══════════════════════════════════════')
  console.log('  测试结果汇总')
  console.log('═══════════════════════════════════════')
  console.log(`  Step 1 - Access Token: ${testResult.step1 ? '✅ 通过' : '❌ 失败'}`)
  console.log(`  Step 2 - Gateway URL:  ${testResult.step2 ? '✅ 通过' : '❌ 失败'}`)
  console.log(`  Step 3 - WS 连接:      ${testResult.step3 ? '✅ 通过' : '❌ 失败'}`)
  console.log(`  Step 4 - READY 事件:   ${testResult.step4 ? '✅ 通过' : '❌ 失败'}`)

  const allPassed = testResult.step1 && testResult.step2 && testResult.step3 && testResult.step4
  if (allPassed) {
    console.log('\n  🎉 Bot WebSocket 登录测试全部通过！Bot 可以正常运行。')
  } else {
    console.log('\n  ⚠️ 部分步骤失败，请检查:')
    if (!testResult.step1) console.log('    - App ID / App Secret 是否正确')
    if (!testResult.step2) console.log('    - Bot 是否已通过 QQ 开放平台审核')
    if (!testResult.step3) console.log('    - 网络是否能访问 QQ Bot Gateway')
    if (testResult.step3 && !testResult.step4) console.log('    - Intents 权限是否正确配置')
  }
  console.log('═══════════════════════════════════════\n')
}

main().catch((err) => {
  console.error('测试异常:', err)
  cleanup()
  process.exit(1)
})
