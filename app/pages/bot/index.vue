<script setup lang="ts">
// ════════════════════════════════════════════════════
// 机器人管理页面 — Bot 状态、频道列表、连接/断连/解绑
// 仅 QQ 频道模式团队可用
// 通过 WebSocket 与服务端通信，替代 HTTP API 调用
// ════════════════════════════════════════════════════
const store = useAuthStore()
const toast = useToast()
const botWs = useBotWs()

// Bot 状态（从 WebSocket 实时推送）
const loading = ref(true)
const botConfigured = ref(false)
const botAppIdMasked = ref('')
const botChannelId = ref('')
const botIsPrivate = ref(false)
const teamName = ref('')

// 运行时状态
const connectionStatus = ref<string>('not_configured')
const botUsername = ref('')
const botId = ref('')
const sessionId = ref('')
const heartbeatInterval = ref(0)
const connectedDuration = ref(-1)
let durationTimer: ReturnType<typeof setInterval> | null = null

// 同步 WebSocket 状态到本地变量
watch(
  () => botWs.state.status,
  (newStatus) => {
    // 当 WebSocket 推送新状态时，更新本地响应式变量，并在已配置时加载关联数据
    if (!newStatus) return
    loading.value = false
    botConfigured.value = newStatus.configured
    botAppIdMasked.value = newStatus.appId || ''
    botChannelId.value = newStatus.channelId || ''
    botIsPrivate.value = newStatus.isPrivate ?? false
    teamName.value = newStatus.teamName
    connectionStatus.value = newStatus.connectionStatus
    botUsername.value = newStatus.botUsername || ''
    botId.value = newStatus.botId || ''
    sessionId.value = newStatus.sessionId || ''
    heartbeatInterval.value = newStatus.heartbeatInterval || 0
    connectedDuration.value = newStatus.connectedDuration
    startDurationTimer()

    // 如果已配置，加载频道列表和赛场数据
    if (newStatus.configured) {
      loadGuilds()
      loadPermLogs()
      loadArenaList()
    }
  },
  { immediate: true },
)

// 频道（服务器）列表 —— 测试消息级联选择器第一级
const guildList = ref<Array<{ id: string; name: string; ownerId?: string; joinedAt?: string }>>([])
const guildListError = ref('')
const loadingGuilds = ref(false)

// 子频道列表 —— 测试消息级联选择器第二级
// 字段含 type / parentId：基于真实 QQ API 返回（type=0 文字、type=2 可发消息子频道、type=4 为分组父级等）
const subChannelList = ref<Array<{ id: string; name: string; type?: number; parentId?: string }>>(
  [],
)
const loadingSubChannels = ref(false)
const subChannelError = ref('')

// 可接收 Bot 文本消息的子频道类型（经真实 API 验证：type 0=文字子频道，type 2=可发消息子频道）
// type 4=分组父级、10007=帖子子频道、10011=日程 等不可直接发文本消息
const MESSAGEABLE_CHANNEL_TYPES = new Set<number>([0, 2])

// 将子频道按 parent_id 分组，仅保留可发送的类型，生成 USelect 的分组 items（array of arrays）
const subChannelGroups = computed<Array<Array<{ label: string; value: string; type?: string }>>>(
  () => {
    const all = subChannelList.value
    // 父级 id 集合：被其它频道作为 parent_id 引用的即为「分组/分类」，不可作为发送目标
    const parentIds = new Set(
      all.filter((c) => c.parentId && c.parentId !== '0').map((c) => c.parentId as string),
    )
    const leaves = all.filter(
      (c) => MESSAGEABLE_CHANNEL_TYPES.has(c.type ?? -1) && !parentIds.has(c.id),
    )
    if (leaves.length === 0) return []

    const groupsMap = new Map<string, typeof leaves>()
    const topLevel: typeof leaves = []
    for (const c of leaves) {
      const pid = c.parentId && c.parentId !== '0' ? (c.parentId as string) : ''
      if (pid && parentIds.has(pid)) {
        if (!groupsMap.has(pid)) groupsMap.set(pid, [])
        groupsMap.get(pid)!.push(c)
      } else {
        topLevel.push(c)
      }
    }

    const result: Array<Array<any>> = []
    for (const [pid, kids] of groupsMap) {
      const parent = all.find((c) => c.id === pid)
      result.push([
        { type: 'label', label: parent?.name || '分组' },
        ...kids.map((k) => ({ label: k.name, value: k.id })),
      ])
    }
    if (topLevel.length) {
      result.push(topLevel.map((c) => ({ label: c.name, value: c.id })))
    }
    return result
  },
)

// 论坛（帖子）子频道类型：type 10007（经真实 API 验证）
const FORUM_CHANNEL_TYPE = 10007

// 将论坛子频道按 parent_id 分组，生成 USelect 的分组 items（与 subChannelGroups 同构）
const forumChannelGroups = computed<Array<Array<{ label: string; value: string; type?: string }>>>(
  () => {
    const all = subChannelList.value
    const parentIds = new Set(
      all.filter((c) => c.parentId && c.parentId !== '0').map((c) => c.parentId as string),
    )
    const leaves = all.filter((c) => c.type === FORUM_CHANNEL_TYPE && !parentIds.has(c.id))
    if (leaves.length === 0) return []

    const groupsMap = new Map<string, typeof leaves>()
    const topLevel: typeof leaves = []
    for (const c of leaves) {
      const pid = c.parentId && c.parentId !== '0' ? (c.parentId as string) : ''
      if (pid && parentIds.has(pid)) {
        if (!groupsMap.has(pid)) groupsMap.set(pid, [])
        groupsMap.get(pid)!.push(c)
      } else {
        topLevel.push(c)
      }
    }

    const result: Array<Array<any>> = []
    for (const [pid, kids] of groupsMap) {
      const parent = all.find((c) => c.id === pid)
      result.push([
        { type: 'label', label: parent?.name || '分组' },
        ...kids.map((k) => ({ label: k.name, value: k.id })),
      ])
    }
    if (topLevel.length) {
      result.push(topLevel.map((c) => ({ label: c.name, value: c.id })))
    }
    return result
  },
)

// 操作按钮 loading
const actionLoading = ref('') // 'connect' | 'disconnect' | 'unbind'

// 检查是否为 QQ 频道模式
const isQQBotTeam = computed(() => store.user?.mode === 'qq_bot')

// 连接状态显示
const connectionStatusLabel = computed(() => {
  const map: Record<string, string> = {
    connected: '已连接',
    connecting: '连接中',
    disconnected: '已断开',
    error: '连接异常',
    not_configured: '未配置',
  }
  return map[connectionStatus.value] || '未知'
})

const connectionStatusColor = computed<'success' | 'info' | 'error' | 'neutral'>(() => {
  const map: Record<string, 'success' | 'info' | 'error' | 'neutral'> = {
    connected: 'success',
    connecting: 'info',
    disconnected: 'neutral',
    error: 'error',
    not_configured: 'neutral',
  }
  return map[connectionStatus.value] || 'neutral'
})

const statusDotClass = computed(() => {
  const map: Record<string, string> = {
    connected: 'bg-green-500',
    connecting: 'bg-blue-500 animate-pulse',
    disconnected: 'bg-gray-400',
    error: 'bg-red-500',
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
const configForm = reactive({
  botAppId: '',
  botAppSecret: '',
  botChannelId: '',
  botDomain: 'public' as 'public' | 'private',
})
// 私域/公域下拉选项（与消息类型下拉保持一致的 @nuxt/ui 风格）
const botDomainItems = [
  { label: '公域机器人', value: 'public' },
  { label: '私域机器人', value: 'private' },
]
const savingConfig = ref(false)

// 测试消息表单（级联选择：先选服务器/频道，再选子频道）
const testForm = reactive({
  guildId: '',
  subChannelId: '',
  content: '',
})
const sendingMessage = ref(false)

// 测试发帖表单（级联：服务器 → 论坛子频道；正文按行拆段落）
const postForm = reactive({
  guildId: '',
  forumChannelId: '',
  title: '',
  content: '',
})
const postingThread = ref(false)

// ── 权限日志 ──
const permLogs = ref<
  Array<{
    id: string
    action: string
    targetType: string
    targetName: string
    operator: string
    detail: string
    createdAt: string
  }>
>([])
const permLogsTotal = ref(0)
const loadingPermLogs = ref(false)
const permLogError = ref('')

// ── 赛场管理 ──
const arenaList = ref<
  Array<{
    id: string
    name: string
    matchFormat: string
    status: string
    channelId?: string
    guildId?: string
    originalChannelName?: string | null // 语音子频道原名（赛场期间被改名，结束后还原）
    roleCount: number
    totalClaims: number
    createdAt: string
  }>
>([])
const loadingArena = ref(false)
const arenaError = ref('')

// 赛场详情（认领列表）
const showArenaDetail = ref(false)
const arenaDetail = ref<any>(null)
const loadingArenaDetail = ref(false)

// ---------- 数据加载 ----------

// 页面挂载时连接 WebSocket（自动获取状态推送）
onMounted(() => {
  botWs.connect()
})

onUnmounted(() => {
  if (durationTimer) clearInterval(durationTimer)
  botWs.disconnect()
})

async function loadGuilds() {
  loadingGuilds.value = true
  guildListError.value = ''
  try {
    const data = await $fetch<{
      guilds: Array<{ id: string; name: string; ownerId?: string; joinedAt?: string }>
      error?: string
    }>('/api/bot/channels', {
      headers: { Authorization: `Bearer ${store.token}` },
    })
    if (data.error) {
      guildListError.value = data.error
    } else {
      guildList.value = data.guilds
    }
  } catch (e: any) {
    guildListError.value = e?.statusMessage || '获取频道列表失败'
  } finally {
    loadingGuilds.value = false
  }
}

function startDurationTimer() {
  // 启动已连接时长计时器：仅在已连接状态下每秒自增
  if (durationTimer) clearInterval(durationTimer)
  if (connectionStatus.value === 'connected') {
    durationTimer = setInterval(() => {
      connectedDuration.value++
    }, 1000)
  }
}

onUnmounted(() => {
  if (durationTimer) clearInterval(durationTimer)
  botWs.disconnect()
})

// ---------- 操作：保存配置 ----------

async function handleSaveConfig() {
  if (!configForm.botAppId.trim()) {
    toast.add({ title: 'Bot App ID 不能为空', color: 'warning' })
    return
  }
  if (!configForm.botAppSecret.trim()) {
    toast.add({ title: 'Bot App Secret 不能为空', color: 'warning' })
    return
  }
  savingConfig.value = true
  try {
    await $fetch('/api/bot/config', {
      method: 'PUT',
      body: {
        botAppId: configForm.botAppId.trim(),
        botAppSecret: configForm.botAppSecret.trim(),
        botChannelId: configForm.botChannelId.trim() || null,
        botIsPrivate: configForm.botDomain === 'private',
      },
      headers: { Authorization: `Bearer ${store.token}` },
    })
    toast.add({ title: 'Bot 配置成功，正在连接...', color: 'success' })
    configForm.botAppSecret = ''
    configForm.botDomain = 'public'
    // 通过 WebSocket 请求最新状态
    await botWs.fetchStatus()
  } catch (e: any) {
    toast.add({ title: e?.statusMessage || '保存失败', color: 'error' })
  } finally {
    savingConfig.value = false
  }
}

// ---------- 操作：连接 / 断连 / 解绑 ----------

async function handleConnect() {
  actionLoading.value = 'connect'
  try {
    await botWs.connectBot()
    toast.add({ title: '正在重新连接 Bot...', color: 'success' })
    await botWs.fetchStatus()
  } catch (e: any) {
    toast.add({ title: e?.message || '连接失败', color: 'error' })
  } finally {
    actionLoading.value = ''
  }
}

async function handleDisconnect() {
  actionLoading.value = 'disconnect'
  try {
    await botWs.disconnectBot()
    toast.add({ title: 'Bot 连接已断开', color: 'info' })
    await botWs.fetchStatus()
  } catch (e: any) {
    toast.add({ title: e?.message || '断连失败', color: 'error' })
  } finally {
    actionLoading.value = ''
  }
}

async function handleUnbind() {
  actionLoading.value = 'unbind'
  try {
    await $fetch('/api/bot/unbind', {
      method: 'POST',
      headers: { Authorization: `Bearer ${store.token}` },
    })
    toast.add({ title: 'Bot 已解绑', color: 'info' })
    await botWs.fetchStatus()
  } catch (e: any) {
    toast.add({ title: e?.statusMessage || '解绑失败', color: 'error' })
  } finally {
    actionLoading.value = ''
  }
}

// ---------- 选择频道 ----------

// ---------- 测试消息 ----------

async function loadSubChannels(guildId: string) {
  subChannelList.value = []
  testForm.subChannelId = ''
  if (!guildId) return
  loadingSubChannels.value = true
  subChannelError.value = ''
  try {
    const data = await $fetch<{
      channels: Array<{ id: string; name: string; type?: number; parentId?: string }>
      error?: string
    }>(`/api/bot/channels/${guildId}/subchannels`, {
      headers: { Authorization: `Bearer ${store.token}` },
    })
    if (data.error) {
      subChannelError.value = data.error
    } else {
      subChannelList.value = data.channels.map((c: any) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        parentId: c.parentId,
      }))
    }
  } catch (e: any) {
    subChannelError.value = e?.statusMessage || '获取子频道列表失败'
  } finally {
    loadingSubChannels.value = false
  }
}

function onGuildChange(guildId: string) {
  testForm.guildId = guildId
  postForm.forumChannelId = '' // 频道列表变化，清空另一条卡片的论坛选择
  loadSubChannels(guildId)
}

async function handleSendTest() {
  if (!testForm.guildId) {
    toast.add({ title: '请先选择服务器/频道', color: 'warning' })
    return
  }
  if (!testForm.subChannelId) {
    toast.add({ title: '请选择子频道', color: 'warning' })
    return
  }
  if (!testForm.content.trim()) {
    toast.add({ title: '消息内容不能为空', color: 'warning' })
    return
  }
  sendingMessage.value = true
  try {
    await botWs.sendMessage({
      targetId: testForm.subChannelId,
      content: testForm.content.trim(),
      messageType: 'channel',
    })
    toast.add({ title: '测试消息发送成功', color: 'success' })
    testForm.content = ''
  } catch (e: any) {
    toast.add({ title: e?.message || '发送失败', color: 'error' })
  } finally {
    sendingMessage.value = false
  }
}

function onForumGuildChange(guildId: string) {
  postForm.guildId = guildId
  testForm.subChannelId = '' // 频道列表变化，清空另一条卡片的消息子频道选择
  loadSubChannels(guildId)
}

async function handlePostThread() {
  if (!postForm.guildId) {
    toast.add({ title: '请先选择服务器/频道', color: 'warning' })
    return
  }
  if (!postForm.forumChannelId) {
    toast.add({ title: '请选择论坛子频道', color: 'warning' })
    return
  }
  if (!postForm.title.trim()) {
    toast.add({ title: '帖子标题不能为空', color: 'warning' })
    return
  }
  if (!postForm.content.trim()) {
    toast.add({ title: '帖子内容不能为空', color: 'warning' })
    return
  }
  postingThread.value = true
  try {
    await $fetch('/api/bot/forum/post', {
      method: 'POST',
      body: {
        channelId: postForm.forumChannelId,
        title: postForm.title.trim(),
        content: postForm.content,
      },
      headers: { Authorization: `Bearer ${store.token}` },
    })
    toast.add({ title: '测试发帖成功', color: 'success' })
    postForm.title = ''
    postForm.content = ''
    postForm.forumChannelId = ''
  } catch (e: any) {
    toast.add({ title: e?.statusMessage || e?.data?.message || '发帖失败', color: 'error' })
  } finally {
    postingThread.value = false
  }
}

// ── 权限日志加载 ──

async function loadPermLogs() {
  loadingPermLogs.value = true
  permLogError.value = ''
  try {
    const data = await $fetch<{
      success: boolean
      total: number
      logs: Array<{
        id: string
        action: string
        targetType: string
        targetName: string
        operator: string
        detail: string
        createdAt: string
      }>
    }>('/api/bot/permission-logs', {
      query: { limit: 20 },
      headers: { Authorization: `Bearer ${store.token}` },
    })
    permLogs.value = data.logs || []
    permLogsTotal.value = data.total || 0
  } catch (e: any) {
    permLogError.value = e?.statusMessage || '加载权限日志失败'
  } finally {
    loadingPermLogs.value = false
  }
}

// ── 赛场管理加载 ──

async function loadArenaList() {
  loadingArena.value = true
  arenaError.value = ''
  try {
    const data = await $fetch<{
      success: boolean
      total: number
      arenas: Array<{
        id: string
        name: string
        matchFormat: string
        status: string
        channelId?: string
        guildId?: string
        originalChannelName?: string | null
        roleCount: number
        totalClaims: number
        createdAt: string
      }>
    }>('/api/bot/arena/list', {
      headers: { Authorization: `Bearer ${store.token}` },
    })
    arenaList.value = data.arenas || []
  } catch (e: any) {
    arenaError.value = e?.statusMessage || '加载赛场列表失败'
  } finally {
    loadingArena.value = false
  }
}

async function loadArenaDetail(arenaId: string) {
  loadingArenaDetail.value = true
  try {
    const data = await $fetch<{
      success: boolean
      arena: any
    }>('/api/bot/arena/claims', {
      query: { arenaId },
      headers: { Authorization: `Bearer ${store.token}` },
    })
    arenaDetail.value = data.arena
    showArenaDetail.value = true
  } catch (e: any) {
    toast.add({ title: e?.statusMessage || '加载赛场详情失败', color: 'error' })
  } finally {
    loadingArenaDetail.value = false
  }
}

const actionLabels: Record<string, string> = {
  ROUND_SWITCH_ALLOW: '允许发言',
  ROUND_SWITCH_DENY: '禁止发言',
  AUDIENCE_SPEAK_GRANT: '授权发言',
  AUDIENCE_SPEAK_REVOKE: '撤销发言',
  RESET_ALL: '重置权限',
}

// 阵营标签
const sideLabels: Record<string, string> = {
  affirmative: '正方',
  negative: '反方',
  judge: '评委',
  audience: '观众',
}

// ── 赛场操作 ──
const closingArena = ref(false)
const claimingRole = ref('') // 正在认领的角色 ID
const unclaimingUser = ref('') // 正在取消认领的用户 ID

/** 关闭赛场 */
async function handleCloseArena() {
  if (!arenaDetail.value) return
  closingArena.value = true
  try {
    await $fetch('/api/bot/arena/close', {
      method: 'POST',
      body: {
        channelId: arenaDetail.value.channelId || '',
        guildId: arenaDetail.value.guildId || '',
      },
      headers: { Authorization: `Bearer ${store.token}` },
    })
    toast.add({ title: '赛场已删除', color: 'success' })
    showArenaDetail.value = false
    loadArenaList()
  } catch (e: any) {
    const msg = e?.data?.message || e?.statusMessage || '关闭赛场失败'
    toast.add({ title: msg, color: 'error' })
  } finally {
    closingArena.value = false
  }
}

/** 手动认领身份（管理员操作） */
async function handleAdminClaim(roleId: string, userId: string, username: string) {
  if (!userId.trim() || !username.trim()) {
    toast.add({ title: '请输入用户 ID 和用户名', color: 'warning' })
    return
  }
  claimingRole.value = roleId
  try {
    await $fetch('/api/bot/arena/claim', {
      method: 'POST',
      body: {
        arenaId: arenaDetail.value.id,
        roleId,
        userId: userId.trim(),
        username: username.trim(),
        guildId: arenaDetail.value.guildId || '',
      },
      headers: { Authorization: `Bearer ${store.token}` },
    })
    toast.add({ title: `已为「${username}」认领身份`, color: 'success' })
    loadArenaDetail(arenaDetail.value.id)
  } catch (e: any) {
    toast.add({ title: e?.statusMessage || '认领失败', color: 'error' })
  } finally {
    claimingRole.value = ''
  }
}

/** 手动取消认领（管理员操作） */
async function handleAdminUnclaim(userId: string, roleId: string) {
  unclaimingUser.value = userId
  try {
    await $fetch('/api/bot/arena/unclaim', {
      method: 'POST',
      body: {
        arenaId: arenaDetail.value.id,
        userId,
        roleId,
      },
      headers: { Authorization: `Bearer ${store.token}` },
    })
    toast.add({ title: '已取消认领', color: 'success' })
    loadArenaDetail(arenaDetail.value.id)
  } catch (e: any) {
    toast.add({ title: e?.statusMessage || '取消认领失败', color: 'error' })
  } finally {
    unclaimingUser.value = ''
  }
}
</script>

<template>
  <!-- 最外层容器：页面背景 -->
  <div class="min-h-screen">
    <!-- 内容容器：居中布局 -->
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- 加载中 -->
      <div v-if="loading" class="text-center py-12">
        <UIcon name="i-lucide-loader" class="w-8 h-8 animate-spin mx-auto" />
      </div>

      <template v-else>
        <!-- 非 QQ 频道模式：禁止访问 -->
        <div v-if="!isQQBotTeam" class="text-center py-12">
          <UIcon
            name="i-lucide-bot"
            class="w-16 h-16 mx-auto mb-4 text-[var(--color-text-muted)]"
          />
          <h2 class="text-xl font-bold mb-2">无法使用机器人功能</h2>
          <p class="text-[var(--color-text-muted)]">
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
            <p class="text-[var(--color-text-muted)]">
              {{ teamName }}
              <UBadge label="QQ频道模式" color="primary" size="xs" variant="soft" class="ml-2" />
            </p>
            <div class="mt-3">
              <UButton
                as="NuxtLink"
                to="/bot/scheduled"
                variant="outline"
                size="sm"
                icon="i-lucide-calendar-clock"
              >
                定时发布
              </UButton>
            </div>
          </div>

          <!-- ============ Bot 运行状态卡片 ============ -->
          <UCard class="mb-6">
            <template #header>
              <div class="flex items-center gap-2">
                <h2 class="font-bold">Bot 运行状态</h2>
                <UBadge
                  :label="connectionStatusLabel"
                  :color="connectionStatusColor"
                  size="xs"
                  variant="solid"
                />
                <UBadge
                  :label="botIsPrivate ? '私域机器人' : '公域机器人'"
                  :color="botIsPrivate ? 'warning' : 'neutral'"
                  size="xs"
                  variant="soft"
                />
              </div>
            </template>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div class="text-xs text-[var(--color-text-muted)] mb-1">连接状态</div>
                <div class="flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full" :class="statusDotClass" />
                  <span class="text-sm font-medium">{{ connectionStatusLabel }}</span>
                </div>
              </div>
              <div>
                <div class="text-xs text-[var(--color-text-muted)] mb-1">Bot 名称</div>
                <div class="text-sm font-medium">{{ botUsername || '-' }}</div>
              </div>
              <div>
                <div class="text-xs text-[var(--color-text-muted)] mb-1">已连接时长</div>
                <div class="text-sm font-medium">{{ formatDuration(connectedDuration) }}</div>
              </div>
              <div>
                <div class="text-xs text-[var(--color-text-muted)] mb-1">心跳间隔</div>
                <div class="text-sm font-medium">
                  {{ heartbeatInterval ? (heartbeatInterval / 1000).toFixed(1) + '秒' : '-' }}
                </div>
              </div>
              <div>
                <div class="text-xs text-[var(--color-text-muted)] mb-1">Session ID</div>
                <div class="text-sm font-mono truncate max-w-32" :title="sessionId">
                  {{ sessionId ? sessionId.slice(0, 8) + '...' : '-' }}
                </div>
              </div>
              <div>
                <div class="text-xs text-[var(--color-text-muted)] mb-1">Bot ID</div>
                <div class="text-sm font-mono truncate max-w-32" :title="botId">
                  {{ botId || '-' }}
                </div>
              </div>
              <div>
                <div class="text-xs text-[var(--color-text-muted)] mb-1">App ID</div>
                <div class="text-sm font-mono">{{ botAppIdMasked || '-' }}</div>
              </div>
              <div>
                <div class="text-xs text-[var(--color-text-muted)] mb-1">当前频道</div>
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
                  <UInput
                    v-model="configForm.botAppSecret"
                    type="password"
                    placeholder="请输入 QQ Bot App Secret"
                  />
                </UFormField>
                <UFormField
                  label="机器人类型"
                  hint="私域仅频道主可用且可收全量消息；公域可被任意频道添加"
                >
                  <USelect v-model="configForm.botDomain" :items="botDomainItems" />
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
                color="success"
                icon="i-lucide-plug"
                :loading="actionLoading === 'connect'"
                @click="handleConnect"
              >
                连接 Bot
              </UButton>
              <UButton
                v-if="connectionStatus === 'connected'"
                color="info"
                variant="outline"
                icon="i-lucide-plug-zap"
                :loading="actionLoading === 'disconnect'"
                @click="handleDisconnect"
              >
                断开连接
              </UButton>
              <UButton
                color="error"
                variant="outline"
                icon="i-lucide-trash-2"
                :loading="actionLoading === 'unbind'"
                @click="handleUnbind"
              >
                解绑 Bot
              </UButton>
            </div>

            <!-- 测试消息（级联选择：服务器 → 子频道） -->
            <UCard class="mb-6">
              <template #header>
                <h2 class="font-bold">测试消息</h2>
              </template>
              <div class="space-y-4">
                <UFormField label="选择服务器/频道" hint="Bot 所在的频道服务器">
                  <USelect
                    v-model="testForm.guildId"
                    :items="guildList.map((g) => ({ label: g.name, value: g.id }))"
                    placeholder="请选择服务器/频道"
                    :loading="loadingGuilds"
                    :disabled="loadingGuilds"
                    @update:modelValue="onGuildChange"
                  />
                  <p v-if="guildListError" class="text-red-500 text-xs mt-1">
                    {{ guildListError }}
                  </p>
                  <p
                    v-else-if="!loadingGuilds && guildList.length === 0"
                    class="text-[var(--color-text-muted)] text-xs mt-1"
                  >
                    未找到任何频道，请确认 Bot 已被添加到频道中。
                  </p>
                </UFormField>

                <UFormField
                  label="选择子频道"
                  hint="该服务器下可发消息的子频道（按分组归类，消息实际发送目标）"
                >
                  <USelect
                    v-model="testForm.subChannelId"
                    :items="subChannelGroups"
                    placeholder="请选择子频道"
                    :loading="loadingSubChannels"
                    :disabled="!testForm.guildId || loadingSubChannels"
                  />
                  <p v-if="subChannelError" class="text-red-500 text-xs mt-1">
                    {{ subChannelError }}
                  </p>
                </UFormField>

                <UFormField label="消息内容" required>
                  <UTextarea
                    v-model="testForm.content"
                    placeholder="请输入要发送的测试消息内容"
                    :rows="3"
                  />
                </UFormField>
                <UButton
                  color="primary"
                  variant="outline"
                  :loading="sendingMessage"
                  block
                  @click="handleSendTest"
                >
                  发送测试消息
                </UButton>
              </div>
            </UCard>

            <!-- 测试发帖（级联选择：服务器 → 论坛子频道） -->
            <UCard class="mb-6">
              <template #header>
                <h2 class="font-bold">测试发帖</h2>
              </template>
              <div class="space-y-4">
                <UFormField label="选择服务器/频道" hint="Bot 所在的频道服务器">
                  <USelect
                    v-model="postForm.guildId"
                    :items="guildList.map((g) => ({ label: g.name, value: g.id }))"
                    placeholder="请选择服务器/频道"
                    :loading="loadingGuilds"
                    :disabled="loadingGuilds"
                    @update:modelValue="onForumGuildChange"
                  />
                  <p v-if="guildListError" class="text-red-500 text-xs mt-1">
                    {{ guildListError }}
                  </p>
                  <p
                    v-else-if="!loadingGuilds && guildList.length === 0"
                    class="text-[var(--color-text-muted)] text-xs mt-1"
                  >
                    未找到任何频道，请确认 Bot 已被添加到频道中。
                  </p>
                </UFormField>

                <UFormField
                  label="选择论坛子频道"
                  hint="该服务器下的帖子子频道（type 10007），发帖实际目标"
                >
                  <USelect
                    v-model="postForm.forumChannelId"
                    :items="forumChannelGroups"
                    placeholder="请选择论坛子频道"
                    :loading="loadingSubChannels"
                    :disabled="!postForm.guildId || loadingSubChannels"
                  />
                  <p v-if="subChannelError" class="text-red-500 text-xs mt-1">
                    {{ subChannelError }}
                  </p>
                  <p
                    v-else-if="
                      postForm.guildId && !loadingSubChannels && forumChannelGroups.length === 0
                    "
                    class="text-[var(--color-text-muted)] text-xs mt-1"
                  >
                    该服务器下没有帖子子频道（type 10007）
                  </p>
                </UFormField>

                <UFormField label="帖子标题" required>
                  <UInput v-model="postForm.title" placeholder="请输入帖子标题" />
                </UFormField>

                <UFormField label="帖子内容" required hint="每行作为一段落">
                  <UTextarea
                    v-model="postForm.content"
                    placeholder="请输入帖子内容，每行一段"
                    :rows="5"
                  />
                </UFormField>

                <UButton
                  color="primary"
                  variant="outline"
                  :loading="postingThread"
                  block
                  @click="handlePostThread"
                >
                  发送测试帖
                </UButton>
              </div>
            </UCard>
          </template>

          <!-- ============ 赛场管理 + 权限日志 ============ -->
          <template v-if="botConfigured">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <!-- 赛场管理 -->
              <UCard>
                <template #header>
                  <div class="flex items-center justify-between gap-2">
                    <h2 class="font-bold">赛场管理</h2>
                    <UButton
                      variant="ghost"
                      size="xs"
                      icon="i-lucide-refresh-cw"
                      @click="loadArenaList"
                      :loading="loadingArena"
                    />
                  </div>
                </template>
                <div v-if="loadingArena" class="text-center py-4">
                  <UIcon name="i-lucide-loader" class="w-5 h-5 animate-spin mx-auto" />
                </div>
                <div v-else-if="arenaError" class="text-red-500 text-sm py-2">{{ arenaError }}</div>
                <div
                  v-else-if="arenaList.length === 0"
                  class="text-[var(--color-text-muted)] text-sm py-2"
                >
                  暂无赛场记录。在语音子频道中使用
                  <code class="bg-[var(--color-bg-tertiary)] px-1 rounded"
                    >/设置赛场 赛场名 4v4</code
                  >（赛场名不多于 8 个字）创建赛场，语音子频道会自动改名为「赛场名 4v4辩论」。
                </div>
                <div v-else class="space-y-2">
                  <div
                    v-for="arena in arenaList"
                    :key="arena.id"
                    class="flex items-center justify-between p-2 rounded hover:bg-[var(--color-bg-secondary)] transition-colors"
                  >
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-medium">{{ arena.name }}</span>
                        <UBadge
                          :label="arena.status === 'active' ? '活跃' : '已关闭'"
                          :color="arena.status === 'active' ? 'success' : 'neutral'"
                          size="xs"
                          variant="soft"
                        />
                      </div>
                      <div class="text-xs text-[var(--color-text-muted)] mt-0.5 space-y-0.5">
                        <div>
                          语音子频道：<span class="font-medium text-[var(--color-text)]">{{
                            arena.originalChannelName || '未知'
                          }}</span>
                          → 比赛中显示「{{ arena.name }} {{ arena.matchFormat }}辩论」
                        </div>
                        <div>{{ arena.roleCount }} 个身份组 · {{ arena.totalClaims }} 人已认领</div>
                      </div>
                    </div>
                    <UButton
                      size="xs"
                      variant="ghost"
                      icon="i-lucide-eye"
                      :loading="loadingArenaDetail"
                      @click="loadArenaDetail(arena.id)"
                    >
                      查看
                    </UButton>
                  </div>
                </div>
              </UCard>

              <!-- 权限日志 -->
              <UCard>
                <template #header>
                  <div class="flex items-center justify-between">
                    <h2 class="font-bold">权限操作日志</h2>
                    <UButton
                      variant="ghost"
                      size="xs"
                      icon="i-lucide-refresh-cw"
                      @click="loadPermLogs"
                      :loading="loadingPermLogs"
                    />
                  </div>
                </template>
                <div v-if="loadingPermLogs" class="text-center py-4">
                  <UIcon name="i-lucide-loader" class="w-5 h-5 animate-spin mx-auto" />
                </div>
                <div v-else-if="permLogError" class="text-red-500 text-sm py-2">
                  {{ permLogError }}
                </div>
                <div
                  v-else-if="permLogs.length === 0"
                  class="text-[var(--color-text-muted)] text-sm py-2"
                >
                  暂无权限操作记录。权限变更后会自动记录在此。
                </div>
                <div v-else class="space-y-1.5 max-h-80 overflow-y-auto">
                  <div
                    v-for="log in permLogs"
                    :key="log.id"
                    class="flex items-center gap-2 p-1.5 rounded text-xs hover:bg-[var(--color-bg-secondary)]"
                  >
                    <UBadge
                      :label="actionLabels[log.action] || log.action"
                      :color="
                        log.action.includes('DENY') || log.action.includes('REVOKE')
                          ? 'error'
                          : 'success'
                      "
                      size="xs"
                      variant="soft"
                    />
                    <span class="font-medium truncate flex-1">{{ log.targetName }}</span>
                    <span class="text-[var(--color-text-muted)] shrink-0">{{
                      new Date(log.createdAt).toLocaleTimeString()
                    }}</span>
                  </div>
                </div>
                <div
                  v-if="permLogsTotal > 0"
                  class="text-xs text-[var(--color-text-muted)] mt-2 text-center"
                >
                  共 {{ permLogsTotal }} 条记录，显示最近 {{ permLogs.length }} 条
                </div>
              </UCard>
            </div>
          </template>

          <!-- ============ 赛场详情弹窗（认领列表） ============ -->
          <UModal v-model:open="showArenaDetail">
            <template #content>
              <UCard>
                <template #header>
                  <div class="flex items-center justify-between">
                    <h3 class="font-bold">赛场详情</h3>
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-x"
                      @click="
                        () => {
                          showArenaDetail = false
                        }
                      "
                    />
                  </div>
                </template>
                <div v-if="loadingArenaDetail" class="text-center py-8">
                  <UIcon name="i-lucide-loader" class="w-6 h-6 animate-spin mx-auto" />
                </div>
                <div v-else-if="arenaDetail" class="space-y-4">
                  <!-- 基本信息 -->
                  <div class="flex items-center justify-between">
                    <div class="text-sm">
                      <span class="text-[var(--color-text-muted)]">比赛形式：</span>
                      <strong>{{ arenaDetail.matchFormat }}</strong>
                      <UBadge
                        :label="arenaDetail.status === 'active' ? '活跃' : '已关闭'"
                        :color="arenaDetail.status === 'active' ? 'success' : 'neutral'"
                        size="xs"
                        variant="soft"
                        class="ml-2"
                      />
                    </div>
                    <UButton
                      v-if="arenaDetail.status === 'active'"
                      color="error"
                      variant="outline"
                      size="xs"
                      icon="i-lucide-x-circle"
                      :loading="closingArena"
                      @click="handleCloseArena"
                    >
                      关闭赛场
                    </UButton>
                  </div>

                  <div class="text-xs text-[var(--color-text-muted)] space-y-1">
                    <div>
                      赛场名：<span class="text-[var(--color-text)] font-medium">{{
                        arenaDetail.name
                      }}</span>
                    </div>
                    <div>
                      原语音子频道：<span class="text-[var(--color-text)] font-medium">{{
                        arenaDetail.originalChannelName || '未知'
                      }}</span>
                      → 比赛中显示「{{ arenaDetail.name }} {{ arenaDetail.matchFormat }}辩论」
                    </div>
                  </div>

                  <!-- 身份组列表 -->
                  <div class="space-y-2">
                    <div
                      v-for="role in arenaDetail.roles"
                      :key="role.id"
                      class="p-3 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
                    >
                      <div class="flex items-center justify-between mb-1">
                        <div class="flex items-center gap-2">
                          <span class="text-sm font-medium">{{ role.label }}</span>
                          <UBadge
                            :label="sideLabels[role.side] || role.side"
                            size="xs"
                            variant="soft"
                          />
                          <span class="text-xs text-[var(--color-text-muted)]">
                            {{ role.claims.length }}/{{ role.maxClaims }}
                          </span>
                          <span v-if="role.isFull" class="text-xs text-red-500 dark:text-red-400"
                            >已满</span
                          >
                          <span
                            v-else-if="arenaDetail.status === 'active'"
                            class="text-xs text-green-500"
                            >可认领</span
                          >
                        </div>
                        <!-- 手动认领按钮（管理员） -->
                        <div
                          v-if="arenaDetail.status === 'active' && !role.isFull"
                          class="flex items-center gap-1"
                        >
                          <UButton
                            size="xs"
                            variant="ghost"
                            color="primary"
                            icon="i-lucide-user-plus"
                            :loading="claimingRole === role.id"
                            @click="handleAdminClaim(role.id, '', '')"
                          >
                            手动认领
                          </UButton>
                        </div>
                      </div>
                      <!-- 已认领人员 -->
                      <div v-if="role.claims.length > 0" class="flex flex-wrap gap-1 mt-1">
                        <UBadge
                          v-for="claim in role.claims"
                          :key="claim.id"
                          size="xs"
                          variant="solid"
                          color="primary"
                          class="cursor-pointer hover:opacity-80"
                          :title="'点击取消认领'"
                          @click="handleAdminUnclaim(claim.userId, role.id)"
                        >
                          {{ claim.username }}
                          <span class="ml-0.5 opacity-50">x</span>
                        </UBadge>
                      </div>
                      <div v-else class="text-xs text-[var(--color-text-muted)] mt-1">暂无认领</div>
                    </div>
                  </div>
                </div>
              </UCard>
            </template>
          </UModal>

          <!-- 使用说明 -->
          <UCard>
            <template #header>
              <h2 class="font-bold">使用说明</h2>
            </template>
            <div class="text-sm text-[var(--color-text-secondary)] space-y-2">
              <p>
                1. <strong>App ID 和 App Secret</strong> 在
                <a href="https://q.qq.com/" target="_blank" class="text-primary underline"
                  >QQ 开放平台</a
                >
                创建机器人后获取。
              </p>
              <p>
                2. 配置完成后，系统会自动连接 Bot WebSocket，<strong>频道列表</strong>显示 Bot
                所在的服务器。
              </p>
              <p>
                3. <strong>连接/断开</strong>可控制 WebSocket
                状态；<strong>解绑</strong>会清除所有配置和连接。
              </p>
              <p>4. Bot 支持命令：</p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-1 mt-1">
                <div>
                  <code class="bg-[var(--color-bg-tertiary)] px-1 rounded text-xs">/ping</code>
                  <span class="text-xs text-[var(--color-text-muted)]">测试连接</span>
                </div>
                <div>
                  <code class="bg-[var(--color-bg-tertiary)] px-1 rounded text-xs">/help</code>
                  <span class="text-xs text-[var(--color-text-muted)]">帮助信息</span>
                </div>
                <div>
                  <code class="bg-[var(--color-bg-tertiary)] px-1 rounded text-xs"
                    >/设置赛场 赛场名 4v4</code
                  >
                  <span class="text-xs text-[var(--color-text-muted)]"
                    >创建赛场（赛场名必填，≤8字）</span
                  >
                </div>
                <div>
                  <code class="bg-[var(--color-bg-tertiary)] px-1 rounded text-xs">/结束比赛</code>
                  <span class="text-xs text-[var(--color-text-muted)]">关闭赛场</span>
                </div>
                <div>
                  <code class="bg-[var(--color-bg-tertiary)] px-1 rounded text-xs"
                    >/认领 正方一辩</code
                  >
                  <span class="text-xs text-[var(--color-text-muted)]">认领身份</span>
                </div>
                <div>
                  <code class="bg-[var(--color-bg-tertiary)] px-1 rounded text-xs">/取消认领</code>
                  <span class="text-xs text-[var(--color-text-muted)]">取消身份</span>
                </div>
                <div>
                  <code class="bg-[var(--color-bg-tertiary)] px-1 rounded text-xs">/赛场状态</code>
                  <span class="text-xs text-[var(--color-text-muted)]">查看赛场</span>
                </div>
                <div>
                  <code class="bg-[var(--color-bg-tertiary)] px-1 rounded text-xs">/辩题</code>
                  <span class="text-xs text-[var(--color-text-muted)]">查看辩题库</span>
                </div>
                <div>
                  <code class="bg-[var(--color-bg-tertiary)] px-1 rounded text-xs">/赛程</code>
                  <span class="text-xs text-[var(--color-text-muted)]">查看赛程</span>
                </div>
                <div>
                  <code class="bg-[var(--color-bg-tertiary)] px-1 rounded text-xs">/下一场</code>
                  <span class="text-xs text-[var(--color-text-muted)]">下一场比赛</span>
                </div>
                <div>
                  <code class="bg-[var(--color-bg-tertiary)] px-1 rounded text-xs">/排名</code>
                  <span class="text-xs text-[var(--color-text-muted)]">查看排名</span>
                </div>
                <div>
                  <code class="bg-[var(--color-bg-tertiary)] px-1 rounded text-xs">状态</code>
                  <span class="text-xs text-[var(--color-text-muted)]">查看 Bot 状态</span>
                </div>
              </div>
            </div>
          </UCard>
        </template>
      </template>
    </div>
  </div>
</template>
