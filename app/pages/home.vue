<script setup lang="ts">
// ════════════════════════════════════════════════════
// 仪表盘页面 —— 根据用户角色展示不同的管理面板
// - 系统管理员：团队管理、用户管理
// - 团队管理员：赛事管理、QQ机器人状态
// - 子账号：受限视图
// - 个人用户：独立赛事管理
// ════════════════════════════════════════════════════

definePageMeta({ layout: false })

const store = useAuthStore()
const toast = useToast()
const route = useRoute()
const router = useRouter()
const { logout } = useAuth()
const { getTeams, getUsers, createTeam, deleteTeam, deleteUser, resetUserPassword, createUser } = useTeam()
const { getTournaments, getStandaloneMatches } = useTournament()

// ── 侧边栏状态 ──
const sidebarOpen = ref(false)

// 路由切换时关闭侧边栏
watch(() => route.fullPath, () => {
  sidebarOpen.value = false
})

function closeSidebarOnMobile() {
  if (import.meta.client && window.innerWidth < 1024) {
    sidebarOpen.value = false
  }
}

// ── 角色标签 ──
const roleLabelsMap: Record<string, string> = {
  system_admin: '系统管理员',
  admin: '团队管理员',
  subaccount: '子账号',
  individual: '个人用户',
}
const currentRoleLabel = computed(() => roleLabelsMap[store.user?.role ?? ''] ?? '')

// ── 导航项 ──
interface NavItem {
  label: string
  icon: string
  to: string
}

const navItems = computed<NavItem[]>(() => {
  const role = store.user?.role ?? ''
  const mode = store.user?.mode ?? ''
  switch (role) {
    case 'system_admin':
      return [
        { label: '仪表盘', icon: 'i-lucide-layout-dashboard', to: '/home' },
        { label: '团队管理', icon: 'i-lucide-users', to: '/teams' },
      ]
    case 'admin':
    case 'subaccount':
      return [
        { label: '仪表盘', icon: 'i-lucide-layout-dashboard', to: '/home' },
        { label: '赛事管理', icon: 'i-lucide-swords', to: '/tournaments/create' },
        ...(mode === 'qq_bot'
          ? [{ label: '机器人管理', icon: 'i-lucide-bot', to: '/bot' }]
          : []),
      ]
    case 'individual':
      return [
        { label: '个人中心', icon: 'i-lucide-user', to: '/home' },
        { label: '创建赛事', icon: 'i-lucide-plus-circle', to: '/standalone/create' },
      ]
    default:
      return []
  }
})

function isActive(to: string): boolean {
  if (to === '/home') return route.path === '/home'
  return route.path.startsWith(to)
}

// 数据
const teams = ref<any[]>([])
const users = ref<any[]>([])
const tournaments = ref<any[]>([])
const standaloneMatches = ref<any[]>([])
const loading = ref(false)
const loadingTournaments = ref(false)
const loadingStandalone = ref(false)

// 系统管理员视图相关
const showCreateTeamModal = ref(false)
const showCreateUserModal = ref(false)
const showResetPasswordModal = ref(false)
const selectedUserId = ref('')
const newPassword = ref('')

// 创建团队表单
const teamForm = reactive({
  name: '',
  mode: 'team',
  adminUsername: '',
  adminPassword: '',
})

// 创建用户表单
const userForm = reactive({
  username: '',
  password: '',
  mode: 'individual',
  role: 'individual',
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

// QQ机器人生状态
const botConfigured = ref(false)
const botAppIdMasked = ref('')
const botChannelId = ref('')
const homeConnectionStatus = ref('not_configured')
const homeConnectedDuration = ref(-1)

// 轻量 HTTP 快照：避免为读一次状态而开/关 WebSocket（SERVER 端 /api/bot/status）
async function loadBotStatus() {
  if (!isQQBotMode.value) return
  try {
    const s = await $fetch<{
      configured: boolean
      appId: string | null
      channelId: string | null
      connectionStatus: string
      connectedDuration: number
    }>('/api/bot/status', {
      headers: { Authorization: `Bearer ${store.token}` },
    })
    botConfigured.value = s.configured
    botAppIdMasked.value = s.appId || ''
    botChannelId.value = s.channelId || ''
    homeConnectionStatus.value = s.connectionStatus
    homeConnectedDuration.value = s.connectedDuration
  } catch (_e: unknown) {
    // 状态获取失败不影响其余仪表盘渲染
  }
}

const availableRoles = computed(() => {
  switch (userForm.mode) {
    case 'individual':
      return [{ label: '个人用户', value: 'individual' }]
    case 'system':
      return [{ label: '系统管理员', value: 'system_admin' }]
    case 'team':
    case 'qq_bot':
      return [
        { label: '团队管理员', value: 'admin' },
        { label: '子账号', value: 'subaccount' },
      ]
    default:
      return []
  }
})

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
      userForm.role = 'admin'
      break
  }
})

const showTeamSelector = computed(() => {
  return (userForm.mode === 'team' || userForm.mode === 'qq_bot') &&
    (userForm.role === 'admin' || userForm.role === 'subaccount')
})

const individualUsers = computed(() => {
  return users.value.filter((u: any) =>
    u.role === 'individual' || u.role === 'system_admin'
  )
})

async function loadAdminData() {
  loading.value = true
  try {
    const [teamsData, usersData] = await Promise.all([
      getTeams(),
      getUsers(),
    ])
    const individualCount = usersData.filter((u: any) => u.role === 'individual').length
    const personalTeam = {
      id: '__individual__',
      name: '个人团队',
      mode: 'individual',
      memberCount: individualCount,
      tournamentCount: 0,
      isVirtual: true,
    }
    teams.value = [personalTeam, ...teamsData]
    users.value = usersData
  } catch (e: any) {
    toast.add({ title: e.statusMessage || '加载数据失败', color: 'error' })
  } finally {
    loading.value = false
  }
}

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

async function handleCreateUser() {
  if (!userForm.username || !userForm.password) {
    toast.add({ title: '请输入用户名和密码', color: 'warning' })
    return
  }
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

async function loadAdminDashboard() {
  loadingTournaments.value = true
  try {
    const teamId = store.user?.team?.id
    if (teamId) {
      tournaments.value = await getTournaments(teamId)
    }
    loadBotStatus()
  } catch (e: any) {
    toast.add({ title: e?.statusMessage || '加载失败', color: 'error' })
  } finally { loadingTournaments.value = false }
}

async function loadIndividualDashboard() {
  loadingStandalone.value = true
  try {
    standaloneMatches.value = await getStandaloneMatches()
  } catch (e: any) {
    toast.add({ title: e?.statusMessage || '加载失败', color: 'error' })
  } finally { loadingStandalone.value = false }
}

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

function loadDashboard() {
  if (isSystemAdmin.value) {
    loadAdminData()
  } else if (isAdmin.value) {
    loadAdminDashboard()
  } else if (isIndividual.value) {
    loadIndividualDashboard()
  }
}

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
  <div class="layout-root flex h-screen overflow-hidden relative">
    <!-- 移动端遮罩层 -->
    <ClientOnly>
      <Transition name="fade">
        <div
          v-if="sidebarOpen"
          class="sidebar-overlay fixed inset-0 z-40 bg-[var(--overlay-overlay)] lg:hidden"
          @click="() => { sidebarOpen = false }"
        />
      </Transition>
    </ClientOnly>

    <!-- 左侧侧边栏 -->
    <aside
      :class="[
        'sidebar',
        'fixed lg:relative z-50 isolation-isolate flex flex-col h-full w-64 shrink-0 pointer-events-auto',
        'bg-[var(--color-bg-secondary)] backdrop-blur-[20px]',
        'border-r border-[var(--color-border)]',
        'transition-transform duration-300',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      ]"
    >
      <!-- Logo 区域 -->
      <div class="flex items-center gap-3 px-6 py-5">
        <div class="gradient-icon w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
          <UIcon name="i-lucide-trophy" class="w-5 h-5 text-white" />
        </div>
        <div class="flex flex-col leading-tight">
          <span class="text-lg font-bold text-[var(--color-text-primary)] tracking-wide">辩境</span>
          <span class="text-[10px] text-[var(--color-text-muted)]">辩论赛管理系统</span>
        </div>
      </div>

      <!-- 导航区域 -->
      <nav class="sidebar-nav flex-1 mt-2 px-3 overflow-y-auto min-h-0 pointer-events-auto">
        <ul class="space-y-1">
          <li v-for="item in navItems" :key="item.to">
            <NuxtLink
              :to="item.to"
              :class="[
                'sidebar-nav-item',
                'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                'touch-manipulation',
                'pointer-events-auto',
                isActive(item.to)
                  ? 'sidebar-nav-item--active bg-[var(--color-accent-bg)] text-[var(--color-accent-primary)] shadow-sm shadow-[var(--color-accent-primary)]/5'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]',
              ]"
              @click="closeSidebarOnMobile"
            >
              <UIcon :name="item.icon" class="w-5 h-5 shrink-0" />
              <span>{{ item.label }}</span>
            </NuxtLink>
          </li>
        </ul>
      </nav>

      <!-- 底部用户信息 -->
      <div class="border-t border-[var(--color-border)] px-4 py-4 pointer-events-auto">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
            <img
              v-if="store.user?.avatar"
              :src="store.user.avatar"
              :alt="store.user?.username"
              class="w-full h-full object-cover"
            />
            <span v-else>{{ store.user?.username?.charAt(0)?.toUpperCase() }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-[var(--color-text-primary)] truncate">{{ store.user?.nickname || store.user?.username }}</div>
            <div class="text-xs text-[var(--color-text-muted)]">{{ currentRoleLabel }}</div>
          </div>
        </div>
        <div class="grid grid-cols-[5fr_4fr_3fr] gap-2">
          <NuxtLink
            to="/settings"
            class="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-all duration-200 touch-manipulation"
            @click="closeSidebarOnMobile"
          >
            <UIcon name="i-lucide-settings" class="w-4 h-4" />
            <span>设置</span>
          </NuxtLink>
          <button
            class="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-all duration-200 touch-manipulation"
            @click="logout()"
          >
            <UIcon name="i-lucide-log-out" class="w-4 h-4" />
            <span>退出</span>
          </button>
          <div class="flex justify-center">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </aside>

    <!-- 右侧主内容区 -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- 移动端顶栏 -->
      <header class="mobile-header lg:hidden flex items-center justify-between px-4 h-14 bg-[var(--color-bg-secondary)] backdrop-blur-md border-b border-[var(--color-border)]">
        <button class="hamburger-btn p-2 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-all duration-200" @click="() => { sidebarOpen = true }">
          <UIcon name="i-lucide-menu" class="w-5 h-5" />
        </button>
        <NuxtLink to="/home" class="flex items-center gap-2">
          <div class="gradient-icon w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <UIcon name="i-lucide-trophy" class="w-3.5 h-3.5 text-white" />
          </div>
          <span class="text-sm font-bold text-[var(--color-text-primary)]">辩境</span>
        </NuxtLink>
        <div class="w-9 h-9" />
      </header>

      <!-- 页面主体 -->
      <main class="main-content flex-1 overflow-y-auto p-8">
        <div class="max-w-7xl mx-auto fade-in">

    <!-- 系统管理员仪表盘 -->
    <ClientOnly v-if="isSystemAdmin">
      <div class="mb-8">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold text-[var(--color-text-primary)]">系统管理仪表盘</h1>
            <p class="text-[var(--color-text-secondary)] mt-2">管理系统中的所有团队和用户</p>
          </div>
          <div class="glass-card p-3 flex items-center gap-2">
            <UBadge label="系统管理员模式" color="error" variant="soft" />
            <span class="text-sm text-[var(--color-text-muted)]">拥有最高权限</span>
          </div>
        </div>
      </div>

      <div v-if="loading" class="text-center py-12">
        <UIcon name="i-lucide-loader" class="w-8 h-8 animate-spin mx-auto text-indigo-400" />
        <p class="text-[var(--color-text-muted)] mt-2">加载中...</p>
      </div>

      <template v-else>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div class="glass-card-strong p-6 text-center cursor-pointer hover:bg-[var(--color-bg-tertiary)] transition-all" @click="() => { showCreateTeamModal = true }">
            <div class="stat-icon bg-indigo-500/20 text-indigo-400 mx-auto mb-3">
              <UIcon name="i-lucide-plus-circle" class="w-6 h-6" />
            </div>
            <div class="text-sm font-medium text-[var(--color-text-primary)]">创建团队</div>
          </div>
          <div class="glass-card-strong p-6 text-center cursor-pointer hover:bg-[var(--color-bg-tertiary)] transition-all" @click="() => { showCreateUserModal = true }">
            <div class="stat-icon bg-indigo-500/20 text-indigo-400 mx-auto mb-3">
              <UIcon name="i-lucide-user-plus" class="w-6 h-6" />
            </div>
            <div class="text-sm font-medium text-[var(--color-text-primary)]">创建用户</div>
          </div>
          <div class="glass-card-strong p-6 text-center">
            <div class="stat-icon bg-indigo-500/20 text-indigo-400 mx-auto mb-3">
              <UIcon name="i-lucide-users" class="w-6 h-6" />
            </div>
            <div class="text-3xl font-bold text-[var(--color-text-primary)]">{{ teams.length }}</div>
            <div class="text-sm text-[var(--color-text-muted)]">团队总数</div>
          </div>
          <div class="glass-card-strong p-6 text-center">
            <div class="stat-icon bg-indigo-500/20 text-indigo-400 mx-auto mb-3">
              <UIcon name="i-lucide-user" class="w-6 h-6" />
            </div>
            <div class="text-3xl font-bold text-[var(--color-text-primary)]">{{ users.length }}</div>
            <div class="text-sm text-[var(--color-text-muted)]">用户总数</div>
          </div>
        </div>

        <h2 class="text-xl font-bold text-[var(--color-text-primary)] mb-4">团队列表</h2>
        <div class="glass-card p-6 mb-8">
          <div v-if="teams.length === 0" class="text-center py-8 text-[var(--color-text-muted)]">
            暂无团队，点击"创建团队"开始
          </div>
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
                  <td class="font-medium text-[var(--color-text-primary)]">
                    {{ t.name }}
                    <span v-if="t.isVirtual" class="text-xs text-[var(--color-text-muted)] ml-2">(虚拟团队)</span>
                  </td>
                  <td>
                    <UBadge v-if="t.isVirtual" label="个人模式" color="success" size="xs" variant="soft" />
                    <UBadge v-else :label="t.mode === 'qq_bot' ? 'QQ频道' : '普通'" :color="t.mode === 'qq_bot' ? 'primary' : 'neutral'" size="xs" variant="soft" />
                  </td>
                  <td>{{ t.memberCount ?? 0 }}</td>
                  <td>{{ t.tournamentCount ?? 0 }}</td>
                  <td class="text-right">
                    <UButton v-if="!t.isVirtual" color="error" variant="ghost" size="xs" @click="handleDeleteTeam(t.id, t.name)">删除</UButton>
                    <span v-else class="text-xs text-[var(--color-text-muted)]">不可删除</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <h2 class="text-xl font-bold text-[var(--color-text-primary)] mb-4">系统与个人用户</h2>
        <div class="glass-card p-6">
          <div v-if="individualUsers.length === 0" class="text-center py-8 text-[var(--color-text-muted)]">
            暂无系统或个人用户
          </div>
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
                  <td class="font-medium text-[var(--color-text-primary)]">{{ u.username }}</td>
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

    <!-- 弹窗们 -->
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
          <UButton color="neutral" variant="outline" @click="() => { showCreateTeamModal = false }">取消</UButton>
          <UButton color="primary" @click="handleCreateTeam">创建</UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="showCreateUserModal" title="创建用户">
      <template #body>
        <div class="space-y-4">
          <UFormField label="用户名" required>
            <UInput v-model="userForm.username" placeholder="请输入用户名" />
          </UFormField>
          <UFormField label="密码" required>
            <UInput v-model="userForm.password" type="password" placeholder="至少6位" />
          </UFormField>
          <UFormField label="使用模式" required>
            <USelect v-model="userForm.mode" :items="[
              { label: '系统管理', value: 'system' },
              { label: 'QQ频道', value: 'qq_bot' },
              { label: '普通团队', value: 'team' },
              { label: '个人模式', value: 'individual' },
            ]" />
          </UFormField>
          <UFormField label="角色" required>
            <USelect v-model="userForm.role" :items="availableRoles"
              :disabled="userForm.mode === 'individual' || userForm.mode === 'system'"
              :help="userForm.mode === 'individual' ? '个人模式自动设为个人用户' :
                userForm.mode === 'system' ? '系统管理模式自动设为系统管理员' : '请选择该用户的团队角色'" />
          </UFormField>
          <UFormField v-if="showTeamSelector" label="所属团队" required>
            <USelect v-model="userForm.teamId"
              :items="teams.map((t: any) => ({ label: t.name, value: t.id }))"
              placeholder="请选择团队" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="outline" @click="() => { showCreateUserModal = false }">取消</UButton>
          <UButton color="primary" @click="handleCreateUser">创建</UButton>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="showResetPasswordModal" title="重置密码">
      <template #body>
        <UFormField label="新密码" required>
          <UInput v-model="newPassword" type="password" placeholder="至少6位" />
        </UFormField>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="neutral" variant="outline" @click="() => { showResetPasswordModal = false }">取消</UButton>
          <UButton color="primary" @click="handleResetPassword">确认重置</UButton>
        </div>
      </template>
    </UModal>

    <!-- 团队管理员仪表盘 -->
    <ClientOnly v-if="isAdmin">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-[var(--color-text-primary)]">团队管理面板</h1>
        <p class="text-[var(--color-text-secondary)] mt-2" v-if="store.user?.team">
          {{ store.user.team.name }}（{{ isQQBotMode ? 'QQ频道模式' : '普通模式' }}）
        </p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div class="glass-card-strong p-6 text-center cursor-pointer hover:bg-[var(--color-bg-tertiary)] transition-all" @click="navigateTo('/tournaments/create')">
          <div class="stat-icon bg-indigo-500/20 text-indigo-400 mx-auto mb-3">
            <UIcon name="i-lucide-trophy" class="w-6 h-6" />
          </div>
          <div class="text-sm font-medium text-[var(--color-text-primary)]">创建赛事</div>
        </div>
        <div class="glass-card-strong p-6 text-center cursor-pointer hover:bg-[var(--color-bg-tertiary)] transition-all" @click="navigateTo('/home')">
          <div class="stat-icon bg-indigo-500/20 text-indigo-400 mx-auto mb-3">
            <UIcon name="i-lucide-clipboard-check" class="w-6 h-6" />
          </div>
          <div class="text-sm font-medium text-[var(--color-text-primary)]">登记赛果</div>
          <div class="text-xs text-[var(--color-text-muted)] mt-1">在赛事详情中登记</div>
        </div>
        <div class="glass-card-strong p-6 text-center cursor-pointer hover:bg-[var(--color-bg-tertiary)] transition-all" @click="navigateTo(`/teams/${store.user?.team?.id}`)">
          <div class="stat-icon bg-indigo-500/20 text-indigo-400 mx-auto mb-3">
            <UIcon name="i-lucide-users" class="w-6 h-6" />
          </div>
          <div class="text-sm font-medium text-[var(--color-text-primary)]">团队管理</div>
        </div>
      </div>

      <div v-if="isQQBotMode" class="glass-card p-4 mb-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <UIcon name="i-lucide-bot" class="w-6 h-6" :class="homeConnectionStatus === 'connected' ? 'text-green-400' : homeConnectionStatus === 'connecting' ? 'text-blue-400' : 'text-[var(--color-text-muted)]'" />
            <div>
              <div class="font-medium text-[var(--color-text-primary)]">QQ机器人</div>
              <div class="text-sm text-[var(--color-text-secondary)]">
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

      <h2 class="text-xl font-bold text-[var(--color-text-primary)] mb-4">赛事列表</h2>
      <div class="glass-card p-6">
        <div v-if="loadingTournaments" class="text-center py-8">
          <UIcon name="i-lucide-loader" class="w-6 h-6 animate-spin mx-auto text-indigo-400" />
        </div>
        <div v-else-if="tournaments.length === 0" class="text-center py-8 text-[var(--color-text-muted)]">
          暂无赛事，点击"创建赛事"开始
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm table-glass">
            <thead>
              <tr>
                <th class="text-left">赛事名称</th>
                <th class="text-left">赛制</th>
                <th class="text-left">状态</th>
                <th class="text-left">场次数</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="t in tournaments"
                :key="t.id"
                class="cursor-pointer"
                @click="navigateTo(`/tournaments/${t.id}`)"
              >
                <td class="font-medium text-[var(--color-text-primary)]">{{ t.name }}</td>
                <td>{{ t.format === 'knockout' ? '淘汰赛' : '循环赛' }}</td>
                <td>
                  <UBadge :label="({ pending: '待开始', running: '进行中', finished: '已完成' } as Record<string,string>)[t.status] || t.status"
                    :color="(({ pending: 'neutral', running: 'primary', finished: 'success' } as Record<string,string>)[t.status] || 'neutral') as any"
                    size="xs" variant="soft" />
                </td>
                <td>{{ t.matchCount ?? 0 }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </ClientOnly>

    <!-- 子账号仪表盘 -->
    <template v-else-if="isSubaccount">
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-[var(--color-text-primary)]">欢迎回来</h1>
        <p class="text-[var(--color-text-secondary)] mt-2" v-if="store.user?.team">
          团队：{{ store.user.team.name }}（子账号）
        </p>
      </div>

      <div class="glass-card p-4 mb-6 border-l-4 border-l-amber-400/60">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-info" class="w-4 h-4 text-amber-400" />
          <span class="text-sm text-[var(--color-text-primary)]">您是子账号，部分功能不可用</span>
        </div>
      </div>

      <h2 class="text-xl font-bold text-[var(--color-text-primary)] mb-4">赛事列表</h2>
      <div class="glass-card p-6">
        <div class="text-center py-8 text-[var(--color-text-muted)]">
          暂无可查看的赛事，请联系团队管理员分配任务
        </div>
      </div>
    </template>

    <!-- 个人用户仪表盘 -->
    <ClientOnly v-if="isIndividual">
      <div class="mb-8">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold text-[var(--color-text-primary)]">个人中心</h1>
            <p class="text-[var(--color-text-secondary)] mt-2">管理您的独立赛事</p>
          </div>
          <div class="glass-card p-3 flex items-center gap-2">
            <UBadge label="个人模式" color="success" variant="soft" />
            <span class="text-sm text-[var(--color-text-muted)]">独立使用，无需团队</span>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div class="glass-card-strong p-6 text-center cursor-pointer hover:bg-[var(--color-bg-tertiary)] transition-all" @click="navigateTo('/standalone/create')">
          <div class="stat-icon bg-indigo-500/20 text-indigo-400 mx-auto mb-3">
            <UIcon name="i-lucide-plus-circle" class="w-6 h-6" />
          </div>
          <div class="text-sm font-medium text-[var(--color-text-primary)]">创建独立赛事</div>
        </div>
      </div>

      <h2 class="text-xl font-bold text-[var(--color-text-primary)] mb-4">我的赛事</h2>
      <div class="glass-card p-6">
        <div v-if="loadingStandalone" class="text-center py-8">
          <UIcon name="i-lucide-loader" class="w-6 h-6 animate-spin mx-auto text-indigo-400" />
        </div>
        <div v-else-if="standaloneMatches.length === 0" class="text-center py-8 text-[var(--color-text-muted)]">
          暂无独立赛事，点击上方按钮创建
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm table-glass">
            <thead>
              <tr>
                <th class="text-left">赛事名称</th>
                <th class="text-left">状态</th>
                <th class="text-left">场次数</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="m in standaloneMatches"
                :key="m.id"
                class="cursor-pointer"
                @click="navigateTo(`/standalone/${m.id}`)"
              >
                <td class="font-medium text-[var(--color-text-primary)]">{{ m.name }}</td>
                <td>
                  <UBadge :label="({ pending: '待开始', running: '进行中', finished: '已完成' } as Record<string,string>)[m.status] || m.status"
                    :color="(({ pending: 'neutral', running: 'primary', finished: 'success' } as Record<string,string>)[m.status] || 'neutral') as any"
                    size="xs" variant="soft" />
                </td>
                <td>{{ m.matchCount ?? 0 }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </ClientOnly>

        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.table-glass tbody tr {
  cursor: pointer;
  transition: background 0.2s ease;
}

.border-l-amber-400\/60 {
  border-left-color: rgba(251, 191, 36, 0.6);
}

.sidebar-nav::-webkit-scrollbar { width: 4px; }
.sidebar-nav::-webkit-scrollbar-track { background: transparent; }
.sidebar-nav::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 2px; }

.sidebar-nav {
  -webkit-overflow-scrolling: touch;
  overflow-y: auto;
  -webkit-tap-highlight-color: transparent;
}

.sidebar-nav-item {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.main-content::-webkit-scrollbar { width: 6px; }
.main-content::-webkit-scrollbar-track { background: transparent; }
.main-content::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.08); border-radius: 3px; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
