<script setup lang="ts">
// ════════════════════════════════════════════════════
// 机器人管理页面 — Bot 状态、频道列表、连接/断连/解绑
// 仅 QQ 频道模式团队可用
// ════════════════════════════════════════════════════
const store = useAuthStore()
const toast = useToast()

// Bot 状态
const loading = ref(true)
const botConfigured = ref(false)
const botAppIdMasked = ref('')
const botChannelId = ref('')
const teamName = ref('')

// 运行时状态
const connectionStatus = ref<string>('not_configured')
const botUsername = ref('')
const botId = ref('')
const sessionId = ref('')
const heartbeatInterval = ref(0)
const connectedDuration = ref(-1)
let durationTimer: ReturnType<typeof setInterval> | null = null

// 频道列表
const channelList = ref<Array<{ id: string; name: string; ownerId?: string; joinedAt?: string }>>([])
const channelListError = ref('')
const loadingChannels = ref(false)
const selectingChannel = ref(false)

// 操作按钮 loading
const actionLoading = ref('') // 'connect' | 'disconnect' | 'unbind'

// 检查是否为 QQ 频道模式
const isQQBotTeam = computed(() => store.user?.mode === 'qq_bot')

// 连接状态显示
const connectionStatusLabel = computed(() => {
  const map: Record<string, string> = {
    connected: '已连接', connecting: '连接中',
    disconnected: '已断开', error: '连接异常',
    not_configured: '未配置',
  }
  return map[connectionStatus.value] || '未知'
})

const connectionStatusColor = computed<
  'success' | 'info' | 'error' | 'neutral'
>(() => {
  const map: Record<string, 'success' | 'info' | 'error' | 'neutral'> = {
    connected: 'success', connecting: 'info',
    disconnected: 'neutral', error: 'error',
    not_configured: 'neutral',
  }
  return map[connectionStatus.value] || 'neutral'
})

const statusDotClass = computed(() => {
  const map: Record<string, string> = {
    connected: 'bg-green-500', connecting: 'bg-blue-500 animate-pulse',
    disconnected: 'bg-gray-400', error: 'bg-red-500',
    not_configured: 'bg-gray-300',
  }
  return map[connectionStatus.value] || 'bg-gray-300'
})

function formatDuration(seconds: number): string {
  if (seconds < 0) return '-'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}时${m}分${s}秒`
  if (m > 0) return `${m}分${s}秒`
  return `${s}秒`
}

// 配置表单（仅未配置时显示）
const configForm = reactive({ botAppId: '', botAppSecret: '', botChannelId: '' })
const savingConfig = ref(false)

// 测试消息表单
const testForm = reactive({
  targetId: '',
  content: '',
  messageType: 'channel' as 'channel' | 'group' | 'private',
})
const sendingMessage = ref(false)

// ---------- 数据加载 ----------

async function loadStatus() {
  loading.value = true
  try {
    const data = await $fetch<{
      configured: boolean; teamName: string; appId: string | null
      channelId: string | null; connectionStatus: string
      botUsername?: string; botId?: string; sessionId?: string
      heartbeatInterval?: number; connectedDuration: number
    }>('/api/bot/status', {
      headers: { Authorization: `Bearer ${store.token}` },
    })
    botConfigured.value = data.configured
    botAppIdMasked.value = data.appId || ''
    botChannelId.value = data.channelId || ''
    teamName.value = data.teamName
    connectionStatus.value = data.connectionStatus
    botUsername.value = data.botUsername || ''
    botId.value = data.botId || ''
    sessionId.value = data.sessionId || ''
    heartbeatInterval.value = data.heartbeatInterval || 0
    connectedDuration.value = data.connectedDuration
    startDurationTimer()

    // 如果已配置，获取频道列表
    if (data.configured) {
      loadChannels()
    }
  } catch (_e: unknown) {
    // 加载失败由模板显示提示
  } finally {
    loading.value = false
  }
}

async function loadChannels() {
  loadingChannels.value = true
  channelListError.value = ''
  try {
    const data = await $fetch<{
      guilds: Array<{ id: string; name: string; ownerId?: string; joinedAt?: string }>
      error?: string
    }>('/api/bot/channels', {
      headers: { Authorization: `Bearer ${store.token}` },
    })
    if (data.error) {
      channelListError.value = data.error
    } else {
      channelList.value = data.guilds
    }
  } catch (e: any) {
    channelListError.value = e?.statusMessage || '获取频道列表失败'
  } finally {
    loadingChannels.value = false
  }
}

function startDurationTimer() {
  if (durationTimer) clearInterval(durationTimer)
  if (connectionStatus.value === 'connected') {
    durationTimer = setInterval(() => { connectedDuration.value++ }, 1000)
  }
}

onUnmounted(() => { if (durationTimer) clearInterval(durationTimer) })

// ---------- 操作：保存配置 ----------

async function handleSaveConfig() {
  if (!configForm.botAppId.trim()) {
    toast.add({ title: 'Bot App ID 不能为空', color: 'warning' }); return
  }
  if (!configForm.botAppSecret.trim()) {
    toast.add({ title: 'Bot App Secret 不能为空', color: 'warning' }); return
  }
  savingConfig.value = true
  try {
    await $fetch('/api/bot/config', {
      method: 'PUT',
      body: {
        botAppId: configForm.botAppId.trim(),
        botAppSecret: configForm.botAppSecret.trim(),
        botChannelId: configForm.botChannelId.trim() || null,
      },
      headers: { Authorization: `Bearer ${store.token}` },
    })
    toast.add({ title: 'Bot 配置成功，正在连接...', color: 'success' })
    configForm.botAppSecret = ''
    await loadStatus()
  } catch (e: any) {
    toast.add({ title: e?.statusMessage || '保存失败', color: 'error' })
  } finally { savingConfig.value = false }
}

// ---------- 操作：连接 / 断连 / 解绑 ----------

async function handleConnect() {
  actionLoading.value = 'connect'
  try {
    await $fetch('/api/bot/connect', {
      method: 'POST',
      headers: { Authorization: `Bearer ${store.token}` },
    })
    toast.add({ title: '正在重新连接 Bot...', color: 'success' })
    await loadStatus()
  } catch (e: any) {
    toast.add({ title: e?.statusMessage || '连接失败', color: 'error' })
  } finally { actionLoading.value = '' }
}

async function handleDisconnect() {
  actionLoading.value = 'disconnect'
  try {
    await $fetch('/api/bot/disconnect', {
      method: 'POST',
      headers: { Authorization: `Bearer ${store.token}` },
    })
    toast.add({ title: 'Bot 连接已断开', color: 'info' })
    await loadStatus()
  } catch (e: any) {
    toast.add({ title: e?.statusMessage || '断连失败', color: 'error' })
  } finally { actionLoading.value = '' }
}

async function handleUnbind() {
  actionLoading.value = 'unbind'
  try {
    await $fetch('/api/bot/unbind', {
      method: 'POST',
      headers: { Authorization: `Bearer ${store.token}` },
    })
    toast.add({ title: 'Bot 已解绑', color: 'info' })
    await loadStatus()
  } catch (e: any) {
    toast.add({ title: e?.statusMessage || '解绑失败', color: 'error' })
  } finally { actionLoading.value = '' }
}

// ---------- 选择频道 ----------

async function handleSelectChannel(channelId: string) {
  selectingChannel.value = true
  try {
    await $fetch('/api/bot/config', {
      method: 'PUT',
      body: { botChannelId: channelId },
      headers: { Authorization: `Bearer ${store.token}` },
    })
    toast.add({ title: '默认频道已更新', color: 'success' })
    await loadStatus()
  } catch (e: any) {
    toast.add({ title: e?.statusMessage || '更新失败', color: 'error' })
  } finally { selectingChannel.value = false }
}

// ---------- 测试消息 ----------

async function handleSendTest() {
  if (!testForm.targetId.trim()) {
    toast.add({ title: '目标 ID 不能为空', color: 'warning' }); return
  }
  if (!testForm.content.trim()) {
    toast.add({ title: '消息内容不能为空', color: 'warning' }); return
  }
  sendingMessage.value = true
  try {
    await $fetch('/api/bot/send', {
      method: 'POST',
      body: {
        targetId: testForm.targetId.trim(),
        content: testForm.content.trim(),
        messageType: testForm.messageType,
      },
      headers: { Authorization: `Bearer ${store.token}` },
    })
    toast.add({ title: '测试消息发送成功', color: 'success' })
    testForm.content = ''
  } catch (e: any) {
    toast.add({ title: e?.statusMessage || '发送失败', color: 'error' })
  } finally { sendingMessage.value = false }
}

onMounted(() => loadStatus())
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- 加载中 -->
    <div v-if="loading" class="text-center py-12">
      <UIcon name="i-lucide-loader" class="w-8 h-8 animate-spin mx-auto" />
    </div>

    <template v-else>
      <!-- 非 QQ 频道模式：禁止访问 -->
      <div v-if="!isQQBotTeam" class="text-center py-12">
        <UIcon name="i-lucide-bot" class="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <h2 class="text-xl font-bold mb-2">无法使用机器人功能</h2>
        <p class="text-gray-500">
          当前团队不是 QQ 频道模式，机器人功能仅限 QQ 频道模式团队使用。
        </p>
      </div>

      <!-- QQ 频道模式：管理界面 -->
      <template v-else>
        <!-- 标题 -->
        <div class="mb-6">
          <div class="flex items-center gap-3 mb-2">
            <UIcon name="i-lucide-bot" class="w-8 h-8 text-primary" />
            <h1 class="text-2xl font-bold">机器人管理</h1>
          </div>
          <p class="text-gray-500">
            {{ teamName }}
            <UBadge label="QQ频道模式" color="primary" size="xs" variant="soft" class="ml-2" />
          </p>
        </div>

        <!-- ============ Bot 运行状态卡片 ============ -->
        <UCard class="mb-6">
          <template #header>
            <div class="flex items-center gap-2">
              <h2 class="font-bold">Bot 运行状态</h2>
              <UBadge :label="connectionStatusLabel" :color="connectionStatusColor" size="xs" variant="solid" />
            </div>
          </template>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div class="text-xs text-gray-400 mb-1">连接状态</div>
              <div class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full" :class="statusDotClass" />
                <span class="text-sm font-medium">{{ connectionStatusLabel }}</span>
              </div>
            </div>
            <div>
              <div class="text-xs text-gray-400 mb-1">Bot 名称</div>
              <div class="text-sm font-medium">{{ botUsername || '-' }}</div>
            </div>
            <div>
              <div class="text-xs text-gray-400 mb-1">已连接时长</div>
              <div class="text-sm font-medium">{{ formatDuration(connectedDuration) }}</div>
            </div>
            <div>
              <div class="text-xs text-gray-400 mb-1">心跳间隔</div>
              <div class="text-sm font-medium">{{ heartbeatInterval ? (heartbeatInterval / 1000).toFixed(1) + '秒' : '-' }}</div>
            </div>
            <div>
              <div class="text-xs text-gray-400 mb-1">Session ID</div>
              <div class="text-sm font-mono truncate max-w-32" :title="sessionId">{{ sessionId ? sessionId.slice(0, 8) + '...' : '-' }}</div>
            </div>
            <div>
              <div class="text-xs text-gray-400 mb-1">Bot ID</div>
              <div class="text-sm font-mono truncate max-w-32" :title="botId">{{ botId || '-' }}</div>
            </div>
            <div>
              <div class="text-xs text-gray-400 mb-1">App ID</div>
              <div class="text-sm font-mono">{{ botAppIdMasked || '-' }}</div>
            </div>
            <div>
              <div class="text-xs text-gray-400 mb-1">当前频道</div>
              <div class="text-sm font-mono">{{ botChannelId || '未设置' }}</div>
            </div>
          </div>
        </UCard>

        <!-- ============ 未配置：显示配置表单 ============ -->
        <template v-if="!botConfigured">
          <UCard class="mb-6">
            <template #header>
              <h2 class="font-bold">Bot 配置</h2>
            </template>
            <div class="space-y-4">
              <UFormField label="Bot App ID" required>
                <UInput v-model="configForm.botAppId" placeholder="请输入 QQ Bot App ID" />
              </UFormField>
              <UFormField label="Bot App Secret" required>
                <UInput v-model="configForm.botAppSecret" type="password" placeholder="请输入 QQ Bot App Secret" />
              </UFormField>
              <UFormField label="频道 ID（可选）" hint="Bot 默认发送消息的目标频道 ID">
                <UInput v-model="configForm.botChannelId" placeholder="请输入默认频道 ID" />
              </UFormField>
              <UButton color="primary" :loading="savingConfig" block @click="handleSaveConfig">
                保存配置
              </UButton>
            </div>
          </UCard>
        </template>

        <!-- ============ 已配置：显示管理面板 ============ -->
        <template v-else>
          <!-- 控制按钮行 -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <UButton
              v-if="connectionStatus !== 'connected'"
              color="success" icon="i-lucide-plug" :loading="actionLoading === 'connect'"
              @click="handleConnect">
              连接 Bot
            </UButton>
            <UButton
              v-if="connectionStatus === 'connected'"
              color="info" variant="outline" icon="i-lucide-plug-zap"
              :loading="actionLoading === 'disconnect'" @click="handleDisconnect">
              断开连接
            </UButton>
            <UButton
              color="error" variant="outline" icon="i-lucide-trash-2"
              :loading="actionLoading === 'unbind'" @click="handleUnbind">
              解绑 Bot
            </UButton>
          </div>

          <!-- 频道列表 + 测试消息 -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <!-- 频道列表 -->
            <UCard>
              <template #header>
                <div class="flex items-center justify-between">
                  <h2 class="font-bold">Bot 所在频道</h2>
                  <UButton variant="ghost" size="xs" icon="i-lucide-refresh-cw" @click="loadChannels"
                    :loading="loadingChannels" />
                </div>
              </template>
              <div v-if="loadingChannels" class="text-center py-4">
                <UIcon name="i-lucide-loader" class="w-5 h-5 animate-spin mx-auto" />
              </div>
              <div v-else-if="channelListError" class="text-red-500 text-sm py-2">
                {{ channelListError }}
              </div>
              <div v-else-if="channelList.length === 0" class="text-gray-400 text-sm py-2">
                未找到任何频道，请确认 Bot 已被添加到频道中。
              </div>
              <div v-else class="space-y-2">
                <div v-for="ch in channelList" :key="ch.id"
                  class="flex items-center justify-between p-2 rounded hover:bg-gray-50 transition-colors">
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium truncate">{{ ch.name }}</div>
                    <div class="text-xs text-gray-400 font-mono truncate">{{ ch.id }}</div>
                  </div>
                  <UButton
                    size="xs"
                    :color="botChannelId === ch.id ? 'primary' : 'neutral'"
                    :variant="botChannelId === ch.id ? 'solid' : 'ghost'"
                    :icon="botChannelId === ch.id ? 'i-lucide-check' : undefined"
                    :loading="selectingChannel"
                    :disabled="selectingChannel"
                    @click="handleSelectChannel(ch.id)">
                    {{ botChannelId === ch.id ? '当前' : '选择' }}
                  </UButton>
                </div>
              </div>
            </UCard>

            <!-- 测试消息 -->
            <UCard>
              <template #header>
                <h2 class="font-bold">测试消息</h2>
              </template>
              <div class="space-y-4">
                <UFormField label="消息类型">
                  <USelect v-model="testForm.messageType" :items="[
                    { label: '频道消息', value: 'channel' },
                    { label: '群消息', value: 'group' },
                    { label: '私聊消息', value: 'private' },
                  ]" />
                </UFormField>
                <UFormField label="目标 ID" required hint="频道 ID / 群 ID / 用户 ID">
                  <UInput v-model="testForm.targetId" placeholder="请输入目标 ID" />
                </UFormField>
                <UFormField label="消息内容" required>
                  <UTextarea v-model="testForm.content" placeholder="请输入要发送的测试消息内容" :rows="3" />
                </UFormField>
                <UButton color="primary" variant="outline" :loading="sendingMessage" block @click="handleSendTest">
                  发送测试消息
                </UButton>
              </div>
            </UCard>
          </div>
        </template>

        <!-- 使用说明 -->
        <UCard>
          <template #header>
            <h2 class="font-bold">使用说明</h2>
          </template>
          <div class="text-sm text-gray-600 space-y-2">
            <p>1. <strong>App ID 和 App Secret</strong> 在 <a href="https://q.qq.com/" target="_blank" class="text-primary underline">QQ 开放平台</a> 创建机器人后获取。</p>
            <p>2. 配置完成后，系统会自动连接 Bot WebSocket，<strong>频道列表</strong>显示 Bot 所在的服务器。</p>
            <p>3. <strong>连接/断开</strong>可控制 WebSocket 状态；<strong>解绑</strong>会清除所有配置和连接。</p>
            <p>4. Bot 支持命令：<code class="bg-gray-100 px-1 rounded">/ping</code> <code class="bg-gray-100 px-1 rounded">/help</code> <code class="bg-gray-100 px-1 rounded">/timer N</code> <code class="bg-gray-100 px-1 rounded">/status</code></p>
          </div>
        </UCard>
      </template>
    </template>
  </div>
</template>
