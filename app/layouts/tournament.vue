<!--
  tournament.vue — 赛事详情页专用布局
  - 保留左侧侧边栏（与 default 布局一致）
  - 头部（面包屑、标题、操作按钮）和双层 Tab 导航固定在布局中
  - 切换同赛事下的子页面时，布局不重新渲染，只有内容区域切换
  - 彻底解决 tab 切换时头部和导航闪烁的问题
-->
<script setup lang="ts">
const route = useRoute()
const store = useAuthStore()
const { logout } = useAuth()
const { getTournament } = useTournament()

// 侧边栏展开状态（仅移动端使用）
const sidebarOpen = ref(false)

// 路由切换时自动关闭移动端侧边栏
watch(() => route.fullPath, () => {
  sidebarOpen.value = false
})

function closeSidebarOnMobile() {
  if (window.innerWidth < 1024) {
    sidebarOpen.value = false
  }
}

// ── 角色标签映射 ──
const roleLabels: Record<string, string> = {
  system_admin: '系统管理员',
  admin: '团队管理员',
  subaccount: '子账号',
  individual: '个人用户',
}

const roleLabel = computed(() => roleLabels[store.user?.role ?? ''] ?? '')

// ── 导航项配置（根据角色动态生成） ──
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
        { label: '仪表盘', icon: 'i-lucide-layout-dashboard', to: '/' },
        { label: '团队管理', icon: 'i-lucide-users', to: '/teams' },
      ]
    case 'admin':
    case 'subaccount':
      return [
        { label: '仪表盘', icon: 'i-lucide-layout-dashboard', to: '/' },
        { label: '赛事管理', icon: 'i-lucide-swords', to: '/tournaments/create' },
        ...(mode === 'qq_bot'
          ? [{ label: '机器人管理', icon: 'i-lucide-bot', to: '/bot' }]
          : []),
      ]
    case 'individual':
      return [
        { label: '个人中心', icon: 'i-lucide-user', to: '/' },
        { label: '创建赛事', icon: 'i-lucide-plus-circle', to: '/standalone/create' },
      ]
    default:
      return []
  }
})

function isActive(to: string): boolean {
  if (to === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(to)
}

// ═══════════ 赛事数据 ═══════════
const tournament = ref<any>(null)
const tournamentId = computed(() => route.params.id as string)

// 二级 tab 对应的一级 tab 分组（用于高亮一级 tab）
const primaryTabMap: Record<string, 'basic' | 'audiovisual' | 'advanced'> = {
  '': 'basic',               // 概览
  'info': 'basic',           // 比赛信息
  'timing': 'basic',         // 计时器环节
  'skin': 'audiovisual',     // 背景
  'details': 'audiovisual',  // 界面
  'audio': 'audiovisual',    // 提示音
  'teams': 'audiovisual',    // 队徽
  'schedule': 'advanced',    // 赛程
  'topic-votes': 'advanced', // 辩题投票
  'registrations': 'advanced', // 报名
  'offline': 'advanced',     // 离线版
}

// 当前页面路径的最后一段（用于判断激活哪个二级 tab）
const currentPage = computed(() => {
  const path = route.path
  const parts = path.split('/').filter(Boolean)
  return parts[2] || ''
})

// 当前激活的一级 tab
const activePrimary = computed(() => primaryTabMap[currentPage.value] || 'basic')

// ═══════════ 数据加载（仅在赛事 ID 变化时加载） ═══════════
async function loadTournament() {
  try {
    tournament.value = await getTournament(tournamentId.value)
  } catch (e: any) {
    console.error('加载赛事失败:', e)
  }
}

// 监听赛事 ID 变化，切换赛事时重新加载
watch(tournamentId, () => {
  loadTournament()
}, { immediate: true })

// 向子页面 provide 赛事数据，子页面可直接 inject 使用
provide('tournament', tournament)
</script>

<template>
  <!-- 整体布局：左侧侧边栏 + 右侧主内容区 -->
  <div class="layout-root flex h-screen overflow-hidden">

    <!-- ════════════════════════════════════════════
         移动端遮罩层：点击关闭侧边栏
         ════════════════════════════════════════════ -->
    <ClientOnly>
      <Teleport to="body">
        <Transition name="fade">
          <div
            v-if="sidebarOpen"
            class="sidebar-overlay fixed inset-0 z-40 bg-black/50 lg:hidden"
            @click="sidebarOpen = false"
          />
        </Transition>
      </Teleport>
    </ClientOnly>

    <!-- ════════════════════════════════════════════
         左侧侧边栏
         ════════════════════════════════════════════ -->
    <aside
      :class="[
        'sidebar',
        'fixed lg:relative z-50 lg:z-auto flex flex-col h-full w-64 shrink-0',
        'bg-[rgba(30,27,75,0.9)] backdrop-blur-[20px]',
        'border-r border-white/10',
        'transition-transform duration-300',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      ]"
    >
      <!-- ── Logo 区域 ── -->
      <div class="flex items-center gap-3 px-6 py-5">
        <div class="gradient-icon w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
          <UIcon name="i-lucide-trophy" class="w-5 h-5 text-white" />
        </div>
        <div class="flex flex-col leading-tight">
          <span class="text-lg font-bold text-white tracking-wide">辩境</span>
          <span class="text-[10px] text-indigo-300/60">辩论赛管理系统</span>
        </div>
      </div>

      <!-- ── 导航区域 ── -->
      <nav class="flex-1 mt-2 px-3 overflow-y-auto">
        <ClientOnly>
          <template v-if="store.user">
            <ul class="space-y-1">
              <li v-for="item in navItems" :key="item.to">
                <NuxtLink
                  :to="item.to"
                  :class="[
                    'sidebar-nav-item',
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                    isActive(item.to)
                      ? 'sidebar-nav-item--active bg-white/15 text-white shadow-sm shadow-white/5'
                      : 'text-indigo-200/70 hover:bg-white/10 hover:text-white',
                  ]"
                  @click="closeSidebarOnMobile"
                >
                  <UIcon :name="item.icon" class="w-5 h-5 shrink-0" />
                  <span>{{ item.label }}</span>
                </NuxtLink>
              </li>
            </ul>
          </template>
          <template #fallback>
            <div class="space-y-2 px-3">
              <div v-for="i in 3" :key="i" class="h-10 rounded-lg bg-white/5 animate-pulse" />
            </div>
          </template>
        </ClientOnly>
      </nav>

      <!-- ── 底部用户信息 ── -->
      <div class="border-t border-white/10 px-4 py-4">
        <ClientOnly>
          <template v-if="store.user">
            <div class="flex items-center gap-3 mb-3">
              <div class="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                {{ store.user.username?.charAt(0)?.toUpperCase() }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-white truncate">{{ store.user.username }}</div>
                <div class="text-xs text-indigo-300/60">{{ roleLabel }}</div>
              </div>
            </div>
            <button
              class="sidebar-logout-btn w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-indigo-300/70 hover:bg-white/10 hover:text-white transition-all duration-200"
              @click="logout()"
            >
              <UIcon name="i-lucide-log-out" class="w-4 h-4" />
              <span>退出登录</span>
            </button>
          </template>
          <template #fallback>
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-full bg-white/10 animate-pulse" />
              <div class="flex-1 space-y-1.5">
                <div class="h-3.5 w-20 bg-white/10 rounded animate-pulse" />
                <div class="h-2.5 w-14 bg-white/5 rounded animate-pulse" />
              </div>
            </div>
          </template>
        </ClientOnly>
      </div>
    </aside>

    <!-- ════════════════════════════════════════════
         右侧主内容区
         ════════════════════════════════════════════ -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- 移动端顶栏（768px以下显示） -->
      <header class="mobile-header lg:hidden flex items-center justify-between px-4 h-14 bg-[rgba(30,27,75,0.6)] backdrop-blur-md border-b border-white/10">
        <button class="hamburger-btn p-2 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-all duration-200" @click="sidebarOpen = true">
          <UIcon name="i-lucide-menu" class="w-5 h-5" />
        </button>
        <NuxtLink to="/" class="flex items-center gap-2">
          <div class="gradient-icon w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <UIcon name="i-lucide-trophy" class="w-3.5 h-3.5 text-white" />
          </div>
          <span class="text-sm font-bold text-white">辩境</span>
        </NuxtLink>
        <div class="w-9" />
      </header>

      <!-- 页面主体 -->
      <main class="main-content flex-1 overflow-y-auto">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <!-- ═══ 头部区域（始终显示，数据加载前显示占位） ═══ -->
          <header class="flex items-end justify-between pt-10 pb-5">
            <div>
              <p class="dark-page-breadcrumb text-xs mb-1">
                赛事管理 / ID: {{ tournament?.id || '...' }}
              </p>
              <h1 class="text-white text-[1.75rem] font-bold leading-tight">
                {{ tournament?.name || '加载中...' }}
              </h1>
            </div>
            <div class="flex items-center gap-3">
              <UButton
                color="neutral"
                variant="outline"
                size="sm"
                @click="navigateTo(`/tournaments/${tournamentId}/offline`)"
              >
                离线版下载
              </UButton>
              <UButton
                color="primary"
                size="sm"
                @click="navigateTo(`/tournaments/${tournamentId}/timer`)"
              >
                打开在线版计时器
              </UButton>
            </div>
          </header>

          <!-- ═══ 双层 Tab 导航（始终显示） ═══ -->
          <div class="tab-dark-row1">
            <span :class="['tab-dark-primary', { 'tab-dark-primary--active': activePrimary === 'basic' }]">基础配置</span>
            <span :class="['tab-dark-primary', { 'tab-dark-primary--active': activePrimary === 'audiovisual' }]">视听设计</span>
            <span :class="['tab-dark-primary', { 'tab-dark-primary--active': activePrimary === 'advanced' }]">进阶功能</span>
          </div>
          <div class="tab-dark-row2">
            <NuxtLink :to="`/tournaments/${tournamentId}`" class="tab-dark-secondary" :class="{ 'tab-dark-secondary--active': currentPage === '' }">概览</NuxtLink>
            <NuxtLink :to="`/tournaments/${tournamentId}/info`" class="tab-dark-secondary" :class="{ 'tab-dark-secondary--active': currentPage === 'info' }">比赛信息</NuxtLink>
            <NuxtLink :to="`/tournaments/${tournamentId}/timing`" class="tab-dark-secondary" :class="{ 'tab-dark-secondary--active': currentPage === 'timing' }">计时器环节</NuxtLink>
            <NuxtLink :to="`/tournaments/${tournamentId}/skin`" class="tab-dark-secondary" :class="{ 'tab-dark-secondary--active': currentPage === 'skin' }">背景</NuxtLink>
            <NuxtLink :to="`/tournaments/${tournamentId}/details`" class="tab-dark-secondary" :class="{ 'tab-dark-secondary--active': currentPage === 'details' }">界面</NuxtLink>
            <NuxtLink :to="`/tournaments/${tournamentId}/audio`" class="tab-dark-secondary" :class="{ 'tab-dark-secondary--active': currentPage === 'audio' }">提示音</NuxtLink>
            <NuxtLink :to="`/tournaments/${tournamentId}/teams`" class="tab-dark-secondary" :class="{ 'tab-dark-secondary--active': currentPage === 'teams' }">队徽</NuxtLink>
            <NuxtLink :to="`/tournaments/${tournamentId}/schedule`" class="tab-dark-secondary" :class="{ 'tab-dark-secondary--active': currentPage === 'schedule' }">赛程</NuxtLink>
            <NuxtLink :to="`/tournaments/${tournamentId}/topic-votes`" class="tab-dark-secondary" :class="{ 'tab-dark-secondary--active': currentPage === 'topic-votes' }">辩题投票</NuxtLink>
            <NuxtLink :to="`/tournaments/${tournamentId}/registrations`" class="tab-dark-secondary" :class="{ 'tab-dark-secondary--active': currentPage === 'registrations' }">报名</NuxtLink>
            <NuxtLink :to="`/tournaments/${tournamentId}/offline`" class="tab-dark-secondary" :class="{ 'tab-dark-secondary--active': currentPage === 'offline' }">离线版</NuxtLink>
          </div>

          <!-- ═══ 页面内容区域（子页面内容，切换时平滑过渡） ═══ -->
          <div class="py-6">
            <slot />
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
/* ══════════════════════════════════════════════
   深色玻璃拟态侧边栏布局样式
   ══════════════════════════════════════════════ */

/* 侧边栏滚动条样式：细窄半透明 */
.sidebar::-webkit-scrollbar {
  width: 4px;
}
.sidebar::-webkit-scrollbar-track {
  background: transparent;
}
.sidebar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

/* 主内容区滚动条样式 */
.main-content::-webkit-scrollbar {
  width: 6px;
}
.main-content::-webkit-scrollbar-track {
  background: transparent;
}
.main-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
}

/* 遮罩层淡入淡出动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
