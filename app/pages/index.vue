<script setup lang="ts">
const store = useAuthStore()
const toast = useToast()
const router = useRouter()
const { getTeams, getUsers, createTeam, deleteTeam, deleteUser, resetUserPassword, createUser } = useTeam()
const { getTournaments, getStandaloneMatches } = useTournament()

// 数据
const teams = ref<any[]>([])
const users = ref<any[]>([])
const tournaments = ref<any[]>([])
const standaloneMatches = ref<any[]>([])
const loading = ref(false)
const loadingTeams = ref(false)
const loadingUsers = ref(false)
const loadingTournaments = ref(false)
const loadingStandalone = ref(false)

// 系统管理员视图相关
const showCreateTeamModal = ref(false)
const showCreateUserModal = ref(false)
const showResetPasswordModal = ref(false)
const selectedUserId = ref('')
const newPassword = ref('')

// 创建团队表单 - Bot字段已移除，移至团队详情页编辑
const teamForm = reactive({
  name: '',
  mode: 'team',
  adminUsername: '',
  adminPassword: '',
})

// 创建用户表单 - 模式放在角色之前
const userForm = reactive({
  username: '',
  password: '',
  mode: 'individual', // 模式前置，默认个人模式
  role: 'individual', // 角色自动跟随模式
  teamId: '',
})

// 计算属性：根据当前用户角色判断视图
const isSystemAdmin = computed(() => store.user?.role === 'system_admin')
const isAdmin = computed(() => store.user?.role === 'admin')
const isSubaccount = computed(() => store.user?.role === 'subaccount')
const isIndividual = computed(() => store.user?.role === 'individual')
const isQQBotMode = computed(() => store.user?.mode === 'qq_bot')

// 格式化首页 Bot 连接时长
function formatHomeDuration(seconds: number): string {
  if (seconds < 0) return '-'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}时${m}分`
  if (m > 0) return `${m}分${s}秒`
  return `${s}秒`
}

// QQ机器人生状态（仅 QQ 频道模式加载，通过 WebSocket 获取）
const botConfigured = ref(false)
const botAppIdMasked = ref('')
const botChannelId = ref('')
const homeConnectionStatus = ref('not_configured')
const homeConnectedDuration = ref(-1)
const botWs = useBotWs()

// 加载机器人状态（通过 WebSocket 获取一次，然后断开）
async function loadBotStatus() {
  if (!isQQBotMode.value) return
  try {
    botWs.connect()
    // 等待认证完成
    await new Promise<void>((resolve, reject) => {
      const check = setInterval(() => {
        if (botWs.state.authenticated) {
          clearInterval(check)
          resolve()
        }
        if (!botWs.state.connected) {
          clearInterval(check)
          resolve() // 连接失败也继续
        }
      }, 200)
      // 超时 5 秒
      setTimeout(() => { clearInterval(check); resolve() }, 5000)
    })
    if (botWs.state.status) {
      const s = botWs.state.status
      botConfigured.value = s.configured
      botAppIdMasked.value = s.appId || ''
      botChannelId.value = s.channelId || ''
      homeConnectionStatus.value = s.connectionStatus
      homeConnectedDuration.value = s.connectedDuration
    }
  } catch (_e: unknown) {
    // 静默失败，bot 状态非关键
  } finally {
    botWs.disconnect()
  }
}

// 根据模式自动确定可选角色列表
const availableRoles = computed(() => {
  switch (userForm.mode) {
    case 'individual':
      return [{ label: '个人用户', value: 'individual' }]
    case 'system':
      return [{ label: '系统管理员', value: 'system_admin' }]
    case 'team':
      return [
        { label: '团队管理员', value: 'admin' },
        { label: '子账号', value: 'subaccount' },
      ]
    case 'qq_bot':
      return [
        { label: '团队管理员', value: 'admin' },
        { label: '子账号', value: 'subaccount' },
      ]
    default:
      return []
  }
})

// 模式切换时自动设置对应角色
watch(() => userForm.mode, (newMode) => {
  switch (newMode) {
    case 'individual':
      userForm.role = 'individual'
      userForm.teamId = ''
      break
    case 'system':
      userForm.role = 'system_admin'
      userForm.teamId = ''
      break
    case 'team':
    case 'qq_bot':
      // 团队模式下默认选团队管理员，需要手动选择团队
      userForm.role = 'admin'
      break
  }
})

// 是否需要显示团队选择器（仅团队模式且选择了子账号时需要）
const showTeamSelector = computed(() => {
  return (userForm.mode === 'team' || userForm.mode === 'qq_bot') &&
    (userForm.role === 'admin' || userForm.role === 'subaccount')
})

// 分类用户列表
const individualUsers = computed(() => {
  return users.value.filter((u: any) =>
    u.role === 'individual' || u.role === 'system_admin'
  )
})

// 加载管理员数据
async function loadAdminData() {
  loading.value = true
  try {
    const [teamsData, usersData] = await Promise.all([
      getTeams(),
      getUsers(),
    ])
    // ⭐ 添加虚拟的"个人团队"条目，作为团队管理体系下的特殊团队类型
    const individualCount = usersData.filter((u: any) => u.role === 'individual').length
    const personalTeam = {
      id: '__individual__',
      name: '个人团队',
      mode: 'individual',
      memberCount: individualCount,
      tournamentCount: 0,
      isVirtual: true, // 标记为虚拟团队
    }
    teams.value = [personalTeam, ...teamsData]
    users.value = usersData
  } catch (e: any) {
    toast.add({ title: e.statusMessage || '加载数据失败', color: 'error' })
  } finally {
    loading.value = false
  }
}

// 处理创建团队 - Bot配置将在团队详情页填写
async function handleCreateTeam() {
  if (!teamForm.name || !teamForm.adminUsername || !teamForm.adminPassword) {
    toast.add({ title: '请填写所有必填字段', color: 'warning' })
    return
  }
  try {
    await createTeam({
      name: teamForm.name,
      mode: teamForm.mode,
      adminUsername: teamForm.adminUsername,
      adminPassword: teamForm.adminPassword,
    })
    toast.add({ title: '团队创建成功', color: 'success' })
    showCreateTeamModal.value = false
    // 重置表单
    teamForm.name = ''
    teamForm.adminUsername = ''
    teamForm.adminPassword = ''
    teamForm.mode = 'team'
    loadAdminData()
  } catch (e: any) {
    toast.add({ title: e.statusMessage || e?.data?.statusMessage || '创建失败', color: 'error' })
  }
}

async function handleDeleteTeam(id: string, name: string) {
  if (!confirm(`确定要删除团队「${name}」吗？此操作不可撤销。`)) return
  try {
    await deleteTeam(id)
    toast.add({ title: '团队已删除', color: 'success' })
    loadAdminData()
  } catch (e: any) {
    toast.add({ title: e.statusMessage || '删除失败', color: 'error' })
  }
}

// 处理创建用户 - 模式前置，角色自动确定
async function handleCreateUser() {
  if (!userForm.username || !userForm.password) {
    toast.add({ title: '请填写用户名和密码', color: 'warning' })
    return
  }
  // 团队模式且选择子账号时需要选择所属团队
  if ((userForm.role === 'subaccount') && !userForm.teamId) {
    toast.add({ title: '请选择所属团队', color: 'warning' })
    return
  }
  try {
    await createUser({
      username: userForm.username,
      password: userForm.password,
      role: userForm.role,
      mode: userForm.mode,
      teamId: userForm.teamId || undefined,
    })
    toast.add({ title: '用户创建成功', color: 'success' })
    showCreateUserModal.value = false
    // 重置表单
    userForm.username = ''
    userForm.password = ''
    userForm.mode = 'individual'
    userForm.role = 'individual'
    userForm.teamId = ''
    loadAdminData()
  } catch (e: any) {
    toast.add({ title: e.statusMessage || e?.data?.statusMessage || '创建失败', color: 'error' })
  }
}

async function handleDeleteUser(id: string, username: string) {
  if (!confirm(`确定要删除用户「${username}」吗？此操作不可撤销。`)) return
  try {
    await deleteUser(id)
    toast.add({ title: '用户已删除', color: 'success' })
    loadAdminData()
  } catch (e: any) {
    toast.add({ title: e.statusMessage || '删除失败', color: 'error' })
  }
}

function openResetPassword(userId: string) {
  selectedUserId.value = userId
  newPassword.value = ''
  showResetPasswordModal.value = true
}

async function handleResetPassword() {
  if (!newPassword.value || newPassword.value.length < 6) {
    toast.add({ title: '密码至少6位', color: 'warning' })
    return
  }
  try {
    await resetUserPassword(selectedUserId.value, newPassword.value)
    toast.add({ title: '密码已重置', color: 'success' })
    showResetPasswordModal.value = false
  } catch (e: any) {
    toast.add({ title: e.statusMessage || '重置失败', color: 'error' })
  }
}

// 团队管理员仪表盘数据加载
async function loadAdminDashboard() {
  loadingTournaments.value = true
  try {
    const teamId = store.user?.team?.id
    if (teamId) {
      tournaments.value = await getTournaments(teamId)
    }
    // 同时加载机器人状态
    loadBotStatus()
  } catch (e: any) {
    toast.add({ title: e?.statusMessage || '加载失败', color: 'error' })
  } finally { loadingTournaments.value = false }
}

// 个人用户仪表盘数据加载
async function loadIndividualDashboard() {
  loadingStandalone.value = true
  try {
    standaloneMatches.value = await getStandaloneMatches()
  } catch (e: any) {
    toast.add({ title: e?.statusMessage || '加载失败', color: 'error' })
  } finally { loadingStandalone.value = false }
}

// 角色标签映射
function roleLabel(role: string) {
  const map: Record<string, string> = {
    system_admin: '系统管理员',
    admin: '团队管理员',
    subaccount: '子账号',
    individual: '个人用户',
  }
  return map[role] || role
}

function roleColor(role: string): 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral' {
  const map: Record<string, 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'> = {
    system_admin: 'error',
    admin: 'primary',
    subaccount: 'info',
    individual: 'success',
  }
  return map[role] || 'neutral'
}

// 根据角色加载仪表盘数据
function loadDashboard() {
  if (isSystemAdmin.value) {
    loadAdminData()
  } else if (isAdmin.value) {
    loadAdminDashboard()
  } else if (isIndividual.value) {
    loadIndividualDashboard()
  }
}

// 仅在客户端加载数据，避免 SSR 阶段 API 调用失败导致 client 不重试
onMounted(() => {
  if (!store.isAuthenticated) {
    const stop = watch(() => store.isAuthenticated, (val) => {
      if (val) { loadDashboard(); stop() }
    })
    return
  }
  loadDashboard()
})
</script>

<template>
  <!-- 外层容器：不额外设置背景（body 已有深色渐变） -->
  <div class="min-h-screen p-8 fade-in">
    <div class="max-w-7xl mx-auto">

    <!-- ════════════════════════════════════════
         系统管理员仪表盘
         ════════════════════════════════════════ -->
    <ClientOnly v-if="isSystemAdmin">
      <!-- 页面标题区域 -->
      <div class="mb-8">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold text-white">系统管理仪表盘</h1>
            <p class="text-white/60 mt-2">管理系统中的所有团队和用户</p>
          </div>
          <!-- 当前模式标识：玻璃拟态标签 -->
          <div class="glass-card p-3 flex items-center gap-2">
            <UBadge label="系统管理员模式" color="error" variant="soft" />
            <span class="text-sm text-white/50">拥有最高权限</span>
          </div>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="text-center py-12">
        <UIcon name="i-lucide-loader" class="w-8 h-8 animate-spin mx-auto text-indigo-400" />
        <p class="text-white/50 mt-2">加载中...</p>
      </div>

      <template v-else>
        <!-- 快捷操作卡片（4个） -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <!-- 创建团队 -->
          <div class="glass-card-strong p-6 text-center cursor-pointer hover:bg-white/10 transition-all" @click="showCreateTeamModal = true">
            <div class="stat-icon bg-indigo-500/20 text-indigo-400 mx-auto mb-3">
              <UIcon name="i-lucide-plus-circle" class="w-6 h-6" />
            </div>
            <div class="text-sm font-medium text-white">创建团队</div>
          </div>
          <!-- 创建用户 -->
          <div class="glass-card-strong p-6 text-center cursor-pointer hover:bg-white/10 transition-all" @click="showCreateUserModal = true">
            <div class="stat-icon bg-indigo-500/20 text-indigo-400 mx-auto mb-3">
              <UIcon name="i-lucide-user-plus" class="w-6 h-6" />
            </div>
            <div class="text-sm font-medium text-white">创建用户</div>
          </div>
          <!-- 团队总数 -->
          <div class="glass-card-strong p-6 text-center">
            <div class="stat-icon bg-indigo-500/20 text-indigo-400 mx-auto mb-3">
              <UIcon name="i-lucide-users" class="w-6 h-6" />
            </div>
            <div class="text-3xl font-bold text-white">{{ teams.length }}</div>
            <div class="text-sm text-white/50">团队总数</div>
          </div>
          <!-- 用户总数 -->
          <div class="glass-card-strong p-6 text-center">
            <div class="stat-icon bg-indigo-500/20 text-indigo-400 mx-auto mb-3">
              <UIcon name="i-lucide-user" class="w-6 h-6" />
            </div>
            <div class="text-3xl font-bold text-white">{{ users.length }}</div>
            <div class="text-sm text-white/50">用户总数</div>
          </div>
        </div>

        <!-- 团队列表 -->
        <h2 class="text-xl font-bold text-white mb-4">团队列表</h2>
        <div class="glass-card p-6 mb-8">
          <div v-if="teams.length === 0" class="text-center py-8 text-white/50">
            暂无团队，点击"创建团队"开始
          </div>
          <!-- 团队列表 - 玻璃拟态表格 -->
          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm table-glass">
              <thead>
                <tr>
                  <th class="text-left">团队名称</th>
                  <th class="text-left">模式</th>
                  <th class="text-left">成员数</th>
                  <th class="text-left">赛事数</th>
                  <th class="text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="t in teams" :key="t.id"
                  @click="t.isVirtual ? router.push('/individual-team') : router.push(`/teams/${t.id}`)">
                  <td class="font-medium text-white/90">
                    {{ t.name }}
                    <span v-if="t.isVirtual" class="text-xs text-white/40 ml-2">(虚拟团队)</span>
                  </td>
                  <td>
                    <UBadge v-if="t.isVirtual" label="个人模式" color="success" size="xs" variant="soft" />
                    <UBadge v-else :label="t.mode === 'qq_bot' ? 'QQ频道' : '普通'" :color="t.mode === 'qq_bot' ? 'primary' : 'neutral'" size="xs" variant="soft" />
                  </td>
                  <td>{{ t.memberCount ?? 0 }}</td>
                  <td>{{ t.tournamentCount ?? 0 }}</td>
                  <td class="text-right">
                    <!-- 虚拟团队不允许删除 -->
                    <UButton v-if="!t.isVirtual" color="error" variant="ghost" size="xs" @click="handleDeleteTeam(t.id, t.name)">删除</UButton>
                    <span v-else class="text-xs text-white/40">不可删除</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 系统/个人用户列表 -->
        <h2 class="text-xl font-bold text-white mb-4">系统与个人用户</h2>
        <div class="glass-card p-6">
          <div v-if="individualUsers.length === 0" class="text-center py-8 text-white/50">
            暂无系统或个人用户
          </div>
          <!-- 系统/个人用户 - 玻璃拟态表格 -->
          <div v-else class="overflow-x-auto">
            <table class="w-full text-sm table-glass">
              <thead>
                <tr>
                  <th class="text-left">用户名</th>
                  <th class="text-left">角色</th>
                  <th class="text-left">模式</th>
                  <th class="text-left">创建时间</th>
                  <th class="text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="u in individualUsers" :key="u.id">
                  <td class="font-medium text-white/90">{{ u.username }}</td>
                  <td>
                    <UBadge :label="roleLabel(u.role)" :color="roleColor(u.role)" size="xs" variant="soft" />
                  </td>
                  <td>
                    <UBadge :label="u.mode === 'individual' ? '个人' : '系统'" size="xs" variant="soft" />
                  </td>
                  <td>{{ new Date(u.createdAt).toLocaleDateString('zh-CN') }}</td>
                  <td class="text-right">
                    <UButton color="neutral" variant="ghost" size="xs" @click="openResetPassword(u.id)">重置密码</UButton>
                    <UButton color="error" variant="ghost" size="xs" @click="handleDeleteUser(u.id, u.username)">删除</UButton>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </ClientOnly>

    <!-- ════════════════════════════════════════
         弹窗们（保持 UModal 不变）
         ════════════════════════════════════════ -->

    <!-- 创建团队弹窗 - Bot字段已移除 -->
    <UModal v-model:open="showCreateTeamModal" title="创建团队">
      <template #body>
        <div class="space-y-4">
          <UFormField label="团队名称" required>
            <UInput v-model="teamForm.name" placeholder="如：XX辩论社" />
          </UFormField>
          <UFormField label="团队模式">
            <USelect v-model="teamForm.mode" :items="[
              { label: '普通团队', value: 'team' },
              { label: 'QQ频道团队', value: 'qq_bot' },
            ]" />
          </UFormField>
          <!-- 提示：QQ频道团队的Bot配置请在创建后在团队详情页填写 -->
          <UAlert v-if="teamForm.mode === 'qq_bot'" color="info" variant="soft" title="提示"
            description="Bot App ID、密钥和频道ID请在创建团队后，前往团队详情页的「编辑信息」中配置。" />
          <UFormField label="管理员用户名" required>
            <UInput v-model="teamForm.adminUsername" placeholder="如：辩论社-admin" />
          </UFormField>
          <UFormField label="管理员密码" required>
            <UInput v-model="teamForm.adminPassword" type="password" placeholder="至少6位" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="outline" @click="showCreateTeamModal = false">取消</UButton>
          <UButton color="primary" @click="handleCreateTeam">创建</UButton>
        </div>
      </template>
    </UModal>

    <!-- 创建用户弹窗 - 模式前置，角色自动跟随 -->
    <UModal v-model:open="showCreateUserModal" title="创建用户">
      <template #body>
        <div class="space-y-4">
          <UFormField label="用户名" required>
            <UInput v-model="userForm.username" placeholder="请输入用户名" />
          </UFormField>
          <UFormField label="密码" required>
            <UInput v-model="userForm.password" type="password" placeholder="至少6位" />
          </UFormField>
          <!-- 模式选择前置 -->
          <UFormField label="使用模式" required>
            <USelect v-model="userForm.mode" :items="[
              { label: '系统管理', value: 'system' },
              { label: 'QQ频道', value: 'qq_bot' },
              { label: '普通团队', value: 'team' },
              { label: '个人模式', value: 'individual' },
            ]" />
          </UFormField>
          <!-- 角色根据模式自动确定，团队模式下可选择 -->
          <UFormField label="角色" required>
            <USelect v-model="userForm.role" :items="availableRoles"
              :disabled="userForm.mode === 'individual' || userForm.mode === 'system'"
              :help="userForm.mode === 'individual' ? '个人模式自动设为个人用户' :
                userForm.mode === 'system' ? '系统管理模式自动设为系统管理员' : '请选择该用户的团队角色'" />
          </UFormField>
          <!-- 团队模式下显示团队选择器 -->
          <UFormField v-if="showTeamSelector" label="所属团队" required>
            <USelect v-model="userForm.teamId"
              :items="teams.map((t: any) => ({ label: t.name, value: t.id }))"
              placeholder="请选择团队" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="outline" @click="showCreateUserModal = false">取消</UButton>
          <UButton color="primary" @click="handleCreateUser">创建</UButton>
        </div>
      </template>
    </UModal>

    <!-- 重置密码弹窗 -->
    <UModal v-model:open="showResetPasswordModal" title="重置密码">
      <template #body>
        <UFormField label="新密码" required>
          <UInput v-model="newPassword" type="password" placeholder="至少6位" />
        </UFormField>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="outline" @click="showResetPasswordModal = false">取消</UButton>
          <UButton color="primary" @click="handleResetPassword">确认重置</UButton>
        </div>
      </template>
    </UModal>

    <!-- ════════════════════════════════════════
         团队管理员仪表盘
         ════════════════════════════════════════ -->
    <ClientOnly v-if="isAdmin">
      <!-- 页面标题区域 -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-white">团队管理面板</h1>
        <p class="text-white/60 mt-2" v-if="store.user?.team">
          {{ store.user.team.name }}（{{ isQQBotMode ? 'QQ频道模式' : '普通模式' }}）
        </p>
      </div>

      <!-- 快捷操作卡片（3个） -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <!-- 创建赛事 -->
        <div class="glass-card-strong p-6 text-center cursor-pointer hover:bg-white/10 transition-all" @click="navigateTo('/tournaments/create')">
          <div class="stat-icon bg-indigo-500/20 text-indigo-400 mx-auto mb-3">
            <UIcon name="i-lucide-trophy" class="w-6 h-6" />
          </div>
          <div class="text-sm font-medium text-white">创建赛事</div>
        </div>
        <!-- 登记赛果 -->
        <div class="glass-card-strong p-6 text-center cursor-pointer hover:bg-white/10 transition-all" @click="navigateTo('/')">
          <div class="stat-icon bg-indigo-500/20 text-indigo-400 mx-auto mb-3">
            <UIcon name="i-lucide-clipboard-check" class="w-6 h-6" />
          </div>
          <div class="text-sm font-medium text-white">登记赛果</div>
          <div class="text-xs text-white/50 mt-1">在赛事详情中登记</div>
        </div>
        <!-- 团队管理 -->
        <div class="glass-card-strong p-6 text-center cursor-pointer hover:bg-white/10 transition-all" @click="navigateTo(`/teams/${store.user?.team?.id}`)">
          <div class="stat-icon bg-indigo-500/20 text-indigo-400 mx-auto mb-3">
            <UIcon name="i-lucide-users" class="w-6 h-6" />
          </div>
          <div class="text-sm font-medium text-white">团队管理</div>
        </div>
      </div>

      <!-- QQ机器人状态卡片 -->
      <div v-if="isQQBotMode" class="glass-card p-4 mb-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-bot" class="w-6 h-6" :class="homeConnectionStatus === 'connected' ? 'text-green-400' : homeConnectionStatus === 'connecting' ? 'text-blue-400' : 'text-white/40'" />
            <div>
              <div class="font-medium text-white/90">QQ机器人</div>
              <div class="text-sm text-white/50">
                <template v-if="homeConnectionStatus === 'connected'">
                  <span class="w-1.5 h-1.5 rounded-full bg-green-400 inline-block mr-1" />
                  在线 · 已运行 {{ formatHomeDuration(homeConnectedDuration) }}
                </template>
                <template v-else-if="homeConnectionStatus === 'connecting'">
                  连接中...
                </template>
                <template v-else-if="homeConnectionStatus === 'disconnected' || homeConnectionStatus === 'error'">
                  <span class="w-1.5 h-1.5 rounded-full bg-red-400 inline-block mr-1" />
                  离线 · {{ botAppIdMasked }}
                </template>
                <template v-else>
                  尚未配置 · 请前往机器人管理页面配置
                </template>
              </div>
            </div>
          </div>
          <UButton color="primary" variant="outline" size="xs" to="/bot">管理</UButton>
        </div>
      </div>

      <!-- 赛事列表 -->
      <h2 class="text-xl font-bold text-white mb-4">赛事列表</h2>
      <div class="glass-card p-6">
        <div v-if="loadingTournaments" class="text-center py-8">
          <UIcon name="i-lucide-loader" class="w-6 h-6 animate-spin mx-auto text-indigo-400" />
        </div>
        <div v-else-if="tournaments.length === 0" class="text-center py-8 text-white/50">
          暂无赛事，点击"创建赛事"开始
        </div>
        <!-- 使用玻璃拟态表格 -->
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm table-glass">
            <thead>
              <tr>
                <th class="text-left">赛事名称</th>
                <th class="text-left">赛制</th>
                <th class="text-left">状态</th>
                <th class="text-left">场次数</th>
                <th class="text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in tournaments" :key="t.id">
                <td class="font-medium text-white/90">{{ t.name }}</td>
                <td>{{ t.format === 'knockout' ? '淘汰赛' : '循环赛' }}</td>
                <td>
                  <UBadge :label="({ pending: '待开始', running: '进行中', finished: '已完成' } as Record<string,string>)[t.status] || t.status"
                    :color="(({ pending: 'neutral', running: 'primary', finished: 'success' } as Record<string,string>)[t.status] || 'neutral') as any"
                    size="xs" variant="soft" />
                </td>
                <td>{{ t.matchCount ?? 0 }}</td>
                <td class="text-right">
                  <UButton color="neutral" variant="ghost" size="xs" :to="`/tournaments/${t.id}`">详情</UButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </ClientOnly>

    <!-- ════════════════════════════════════════
         子账号仪表盘
         ════════════════════════════════════════ -->
    <template v-else-if="isSubaccount">
      <!-- 页面标题区域 -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-white">欢迎回来</h1>
        <p class="text-white/60 mt-2" v-if="store.user?.team">
          团队：{{ store.user.team.name }}（子账号）
        </p>
      </div>

      <!-- 子账号提示：玻璃拟态卡片 + 琥珀色左边框 -->
      <div class="glass-card p-4 mb-6 border-l-4 border-l-amber-400/60">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-info" class="w-4 h-4 text-amber-400" />
          <span class="text-sm text-white/80">您是子账号，部分功能不可用</span>
        </div>
      </div>

      <!-- 赛事列表 -->
      <h2 class="text-xl font-bold text-white mb-4">赛事列表</h2>
      <div class="glass-card p-6">
        <div class="text-center py-8 text-white/50">
          暂无可查看的赛事，请联系团队管理员分配任务
        </div>
      </div>
    </template>

    <!-- ════════════════════════════════════════
         个人用户仪表盘
         ════════════════════════════════════════ -->
    <ClientOnly v-if="isIndividual">
      <!-- 页面标题区域 -->
      <div class="mb-8">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold text-white">个人中心</h1>
            <p class="text-white/60 mt-2">管理您的独立赛事</p>
          </div>
          <!-- 当前模式标识：玻璃拟态标签 -->
          <div class="glass-card p-3 flex items-center gap-2">
            <UBadge label="个人模式" color="success" variant="soft" />
            <span class="text-sm text-white/50">独立使用，无需团队</span>
          </div>
        </div>
      </div>

      <!-- 快捷操作卡片 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <!-- 创建独立赛事 -->
        <div class="glass-card-strong p-6 text-center cursor-pointer hover:bg-white/10 transition-all" @click="navigateTo('/standalone/create')">
          <div class="stat-icon bg-indigo-500/20 text-indigo-400 mx-auto mb-3">
            <UIcon name="i-lucide-plus-circle" class="w-6 h-6" />
          </div>
          <div class="text-sm font-medium text-white">创建独立赛事</div>
        </div>
      </div>

      <!-- 我的赛事列表 -->
      <h2 class="text-xl font-bold text-white mb-4">我的赛事</h2>
      <div class="glass-card p-6">
        <div v-if="loadingStandalone" class="text-center py-8">
          <UIcon name="i-lucide-loader" class="w-6 h-6 animate-spin mx-auto text-indigo-400" />
        </div>
        <div v-else-if="standaloneMatches.length === 0" class="text-center py-8 text-white/50">
          暂无独立赛事，点击上方按钮创建
        </div>
        <!-- 个人赛事列表 - 玻璃拟态表格 -->
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm table-glass">
            <thead>
              <tr>
                <th class="text-left">赛事名称</th>
                <th class="text-left">状态</th>
                <th class="text-left">场次数</th>
                <th class="text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in standaloneMatches" :key="m.id">
                <td class="font-medium text-white/90">{{ m.name }}</td>
                <td>
                  <UBadge :label="({ pending: '待开始', running: '进行中', finished: '已完成' } as Record<string,string>)[m.status] || m.status"
                    :color="(({ pending: 'neutral', running: 'primary', finished: 'success' } as Record<string,string>)[m.status] || 'neutral') as any"
                    size="xs" variant="soft" />
                </td>
                <td>{{ m.matchCount ?? 0 }}</td>
                <td class="text-right">
                  <UButton color="neutral" variant="ghost" size="xs" :to="`/standalone/${m.id}`">详情</UButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </ClientOnly>

    </div>
  </div>
</template>

<style scoped>
/* ════════════════════════════════════════
   首页仪表盘 —— 深色玻璃拟态局部样式
   （基础 glass-card / table-glass 等复用 main.css 全局定义）
   ════════════════════════════════════════ */

/* 确保 UTable 内部 tr 在 hover 时有可见反馈（配合全局 table-glass） */
.table-glass tbody tr {
  cursor: pointer;
  transition: background 0.2s ease;
}

/* 子账号提示卡片的琥珀色左边框 */
.border-l-amber-400\/60 {
  border-left-color: rgba(251, 191, 36, 0.6);
}
</style>
