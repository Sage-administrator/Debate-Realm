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

/**
 * 判断当前路由是否匹配导航项
 * 首页 "/" 需精确匹配，其他路由前缀匹配即可
 */
function isActive(to: string): boolean {
  if (to === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(to)
}

// ═══════════ 赛事数据 ═══════════
const tournament = ref<any>(null)
const tournamentId = computed(() => route.params.id as string)

// 三阶段导航配置 - 流程式布局
const stages = [
  {
    id: 'preparation',
    label: '赛前准备',
    icon: 'i-lucide-calendar-days',
    items: [
      { label: '比赛信息', path: 'info' },
      { label: '辩题投票', path: 'topic-votes' },
      { label: '报名管理', path: 'registrations' },
      { label: '赛程安排', path: 'schedule' },
    ],
  },
  {
    id: 'competition',
    label: '赛中计时',
    icon: 'i-lucide-clock',
    items: [
      { label: '计时器环节', path: 'timing' },
      { label: '背景设置', path: 'skin' },
      { label: '界面配置', path: 'details' },
      { label: '提示音', path: 'audio' },
      { label: '队徽设置', path: 'teams' },
    ],
  },
  {
    id: 'statistics',
    label: '赛后统计',
    icon: 'i-lucide-bar-chart-3',
    items: [
      { label: '赛果统计', path: 'result' },
      { label: '评分分析', path: 'score-analysis' },
      { label: '对阵图', path: 'match-chart' },
      { label: '荣誉证书', path: 'certificate' },
    ],
  },
  {
    id: 'realtime',
    label: '实时互动',
    icon: 'i-lucide-messages-square',
    items: [
      { label: '聊天室', path: 'chat' },
    ],
  },
]

// 当前页面路径的最后一段（用于判断激活哪个导航项）
const currentPage = computed(() => {
  const path = route.path
  const parts = path.split('/').filter(Boolean)
  return parts[2] || 'info'
})

// 外层网格列宽：按各阶段二级标签数量比例分配（而非固定三等分），
// 配合列内 `repeat(N, 1fr)`，使所有二级标签等宽、整体分布更平衡
const stageGridColumns = computed(() =>
  stages.map((s) => `${s.items.length}fr`).join(' '),
)

// 判断阶段是否激活（有子页面被选中）
function isStageActive(stageId: string): boolean {
  const stage = stages.find(s => s.id === stageId)
  if (!stage) return false
  return stage.items.some(item => item.path === currentPage.value)
}

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
  <div class="layout-root flex h-screen overflow-hidden relative">

    <!-- ════════════════════════════════════════════
         移动端遮罩层：点击关闭侧边栏
         放在 layout-root 内，与侧边栏共享同一个层叠上下文
         确保侧边栏(z-50)在遮罩层(z-40)之上，侧边栏可正常点击
         ════════════════════════════════════════════ -->
    <ClientOnly>
      <Transition name="fade">
        <div
          v-if="sidebarOpen"
          class="sidebar-overlay fixed inset-0 z-40 bg-[var(--overlay-overlay)] lg:hidden"
          @click="() => { sidebarOpen = false }"
        />
      </Transition>
    </ClientOnly>

    <!-- ════════════════════════════════════════════
         左侧侧边栏
         ════════════════════════════════════════════ -->
    <aside
      :class="[
        'sidebar',
        // z-50 确保侧边栏始终在主内容区之上（不使用 lg:z-auto，避免桌面端 z-index 被重置为 auto）
        // pointer-events-auto 确保可点击；isolation-isolate 创建独立 stacking context
        'fixed lg:relative z-50 isolation-isolate flex flex-col h-full w-64 shrink-0 pointer-events-auto',
        'bg-[var(--color-bg-secondary)] backdrop-blur-[20px]',
        'border-r border-[var(--color-border)]',
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
          <span class="text-lg font-bold text-[var(--color-text-primary)] tracking-wide">辩境</span>
          <span class="text-[10px] text-[var(--color-text-muted)]">辩论赛管理系统</span>
        </div>
      </div>

      <!-- ── 导航区域 ── -->
      <!-- min-h-0 确保 flex-1 在 flex 容器中正确计算高度，避免内容溢出导致点击异常 -->
      <!-- pointer-events-auto 确保导航区域始终能接收点击事件 -->
      <nav class="sidebar-nav flex-1 mt-2 px-3 overflow-y-auto min-h-0 pointer-events-auto">
        <template v-if="store.user">
          <ul class="space-y-1">
            <li v-for="item in navItems" :key="item.to">
              <NuxtLink
                :to="item.to"
                :class="[
                  'sidebar-nav-item',
                  // py-3 确保移动端点击区域至少 44px（符合 Apple HIG 规范）
                  'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                  'touch-manipulation', // 禁用双击缩放，消除移动端点击延迟
                  'pointer-events-auto', // 确保链接可点击
                  isActive(item.to)
                    ? 'sidebar-nav-item--active bg-[var(--color-accent-bg)] text-[var(--color-accent-primary)]'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]',
                ]"
                @click="closeSidebarOnMobile"
              >
                <UIcon :name="item.icon" class="w-5 h-5 shrink-0" />
                <span>{{ item.label }}</span>
              </NuxtLink>
            </li>
          </ul>
        </template>
        <!-- 未加载完成时显示骨架屏（仅客户端，避免 SSR 水合不匹配） -->
        <div v-else class="space-y-2 px-3">
          <div v-for="i in 3" :key="i" class="h-10 rounded-lg bg-[var(--color-bg-tertiary)] animate-pulse" />
        </div>
      </nav>

      <!-- ── 底部用户信息 ── -->
      <div class="border-t border-[var(--color-border)] px-4 py-4 pointer-events-auto">
        <template v-if="store.user">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
              {{ store.user.username?.charAt(0)?.toUpperCase() }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-[var(--color-text-primary)] truncate">{{ store.user.username }}</div>
              <div class="text-xs text-[var(--color-text-muted)]">{{ roleLabel }}</div>
            </div>
          </div>
          <div class="grid grid-cols-[5fr_4fr_3fr] gap-2">
            <NuxtLink
              to="/settings"
              class="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-all duration-200 touch-manipulation"
            >
              <UIcon name="i-lucide-settings" class="w-4 h-4" />
              <span>设置</span>
            </NuxtLink>
            <button
              class="sidebar-logout-btn flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-all duration-200 touch-manipulation"
              @click="logout()"
            >
              <UIcon name="i-lucide-log-out" class="w-4 h-4" />
              <span>退出</span>
            </button>
            <div class="flex justify-center">
              <ThemeToggle />
            </div>
          </div>
        </template>
        <!-- 未加载完成时显示骨架屏 -->
        <div v-else class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-[var(--color-bg-tertiary)] animate-pulse" />
          <div class="flex-1 space-y-1.5">
            <div class="h-3.5 w-20 bg-[var(--color-bg-tertiary)] rounded animate-pulse" />
            <div class="h-2.5 w-14 bg-[var(--color-bg-secondary)] rounded animate-pulse" />
          </div>
        </div>
      </div>
    </aside>

    <!-- ════════════════════════════════════════════
         右侧主内容区
         ════════════════════════════════════════════ -->
    <!-- relative z-0 让主内容区形成独立 stacking context 且层级低于侧边栏(z-50) -->
    <div class="flex-1 flex flex-col overflow-hidden relative z-0">
      <!-- 移动端顶栏（768px以下显示） -->
      <header class="mobile-header lg:hidden flex items-center justify-between px-4 h-14 bg-[var(--color-bg-secondary)] backdrop-blur-md border-b border-[var(--color-border)]">
        <button class="hamburger-btn p-2 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-all duration-200" @click="() => { sidebarOpen = true }">
          <UIcon name="i-lucide-menu" class="w-5 h-5" />
        </button>
        <NuxtLink to="/" class="flex items-center gap-2">
          <div class="gradient-icon w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <UIcon name="i-lucide-trophy" class="w-3.5 h-3.5 text-white" />
          </div>
          <span class="text-sm font-bold text-[var(--color-text-primary)]">辩境</span>
        </NuxtLink>
        <div class="w-9 h-9" />
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
              <h1 class="text-[var(--color-text-primary)] text-[1.75rem] font-bold leading-tight">
                {{ tournament?.name || '加载中...' }}
              </h1>
            </div>
            <div class="flex items-center gap-3">
              <UButton
                color="neutral"
                variant="outline"
                size="sm"
                @click="() => { navigateTo(`/tournaments/${tournamentId}/offline`) }"
              >
                离线版下载
              </UButton>
              <UButton
                color="primary"
                size="sm"
                @click="() => { navigateTo(`/tournaments/${tournamentId}/timer`) }"
              >
                打开在线版计时器
              </UButton>
            </div>
          </header>

          <!-- ═══ 双层级流程式导航（始终显示） ═══ -->
          <!-- 一级：赛前准备 → 赛中计时 → 赛后统计（单行，不可点击，仅作流程指示器）
               二级：全部子模块排在同一条横行，按阶段用徽标+分隔线分组（可自由点击跳转）
               两级均通过序号、连接线体现先后顺序，但不强制按固定顺序操作 -->
          <div class="space-y-6">
            <!-- ═══ 标签式双层导航面板 ═══ -->
            <!-- 列宽按各阶段二级数量比例分配，gap-px 分割线从顶到底贯通；一级为文字标签（不可点击），二级为纯文字标签（可点击、固定位置、直角边） -->
            <div class="grid gap-px rounded-xl overflow-hidden bg-[var(--color-border)]" :style="{ gridTemplateColumns: stageGridColumns }">
              <template v-for="stage in stages" :key="stage.id">
                <div :class="['flex flex-col bg-[var(--color-bg-secondary)]', isStageActive(stage.id) ? 'bg-[var(--color-accent-bg)]' : '']">
                  <!-- 一级标签（不可点击，仅展示） -->
                  <div class="py-2.5 text-center text-sm font-semibold text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
                    {{ stage.label }}
                  </div>

                  <!-- 二级标签（纯文字，固定位置分布，直角边，可点击跳转） -->
                  <div class="grid auto-rows-fr" :style="{ gridTemplateColumns: `repeat(${stage.items.length}, 1fr)` }">
                    <NuxtLink
                      v-for="item in stage.items"
                      :key="item.path"
                      :to="`/tournaments/${tournamentId}/${item.path}`"
                      :class="[
                        'py-2 text-center text-sm cursor-pointer transition-colors duration-200 truncate',
                        currentPage === item.path
                          ? 'text-[var(--color-accent-primary)] font-medium'
                          : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]',
                      ]"
                    >{{ item.label }}</NuxtLink>
                  </div>
                </div>
              </template>
            </div>

            <!-- 快捷操作按钮 -->
            <div class="flex flex-wrap items-center gap-3">
              <span class="text-xs text-[var(--color-text-muted)]">快捷操作：</span>
              <UButton
                color="neutral"
                variant="outline"
                size="sm"
                @click="() => { navigateTo(`/tournaments/${tournamentId}/offline`) }"
              >
                离线版下载
              </UButton>
              <UButton
                color="primary"
                size="sm"
                @click="() => { navigateTo(`/tournaments/${tournamentId}/timer`) }"
              >
                打开在线版计时器
              </UButton>
            </div>
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

/* 侧边栏导航滚动条样式：细窄半透明 */
.sidebar-nav::-webkit-scrollbar {
  width: 4px;
}
.sidebar-nav::-webkit-scrollbar-track {
  background: transparent;
}
.sidebar-nav::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

/* 移动端滚动性能优化：惯性滚动 + 避免点击事件被滚动容器吞掉 */
.sidebar-nav {
  -webkit-overflow-scrolling: touch;
  overflow-y: auto;
  -webkit-tap-highlight-color: transparent; /* 移除点击高亮 */
}

/* 确保导航项在移动端有足够的点击区域和响应速度 */
.sidebar-nav-item {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
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

/* 性能优化：侧边栏滑出动画使用 transform，触发 GPU 合成层 */
.sidebar {
  will-change: transform;
  contain: layout paint style;
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
