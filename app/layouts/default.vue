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
      <!-- 层级根：aside 已设 z-50 + isolation-isolate + pointer-events-auto，nav 及子元素继承即可，无需重复声明 -->
      <nav class="sidebar-nav flex-1 mt-2 px-3 overflow-y-auto min-h-0">
        <template v-if="store.user">
          <ul class="space-y-1">
            <li v-for="item in navItems" :key="item.to">
              <NuxtLink
                :to="item.to"
                :class="[
                  'sidebar-nav-item',
                  'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                  'touch-manipulation',
                  'relative', // 建立定位上下文，确保 hover/active 背景色层级正确
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
        <!-- 未加载完成时显示骨架屏 -->
        <div v-else class="space-y-2 px-3">
          <div v-for="i in 3" :key="i" class="h-10 rounded-lg bg-[var(--color-bg-tertiary)] animate-pulse" />
        </div>
      </nav>

      <!-- ── 底部用户信息 ── -->
      <div class="border-t border-[var(--color-border)] px-4 py-4 pointer-events-auto">
        <template v-if="store.user">
          <div class="flex items-center gap-3 mb-3">
            <!-- 用户头像：有 avatar 显示图片，否则显示首字母 -->
            <div class="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
              <img
                v-if="store.user.avatar"
                :src="store.user.avatar"
                :alt="store.user.username"
                class="w-full h-full object-cover"
              />
              <span v-else>{{ store.user.username?.charAt(0)?.toUpperCase() }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-[var(--color-text-primary)] truncate">{{ store.user.nickname || store.user.username }}</div>
              <div class="text-xs text-[var(--color-text-muted)]">{{ roleLabel }}</div>
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
        </template>
        <!-- 未加载完成时显示骨架屏 -->
        <div v-else class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-[var(--color-bg-tertiary)] animate-pulse" />
          <div class="flex-1 space-y-1.5">
            <div class="h-3.5 w-20 bg-[var(--color-bg-tertiary)] rounded animate-pulse" />
            <div class="h-2.5 w-14 bg-[var(--color-bg-tertiary)]/50 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </aside>

    <!-- ════════════════════════════════════════════
         右侧主内容区
         ════════════════════════════════════════════ -->
    <div class="flex-1 flex flex-col overflow-hidden relative z-0">
      <!-- 移动端顶栏（768px以下显示） -->
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

      <!-- 页面主体（slot） -->
      <main class="main-content flex-1 overflow-y-auto">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * default.vue — 深色玻璃拟态侧边栏布局
 * - 左侧：固定宽度侧边栏（rgba(30,27,75,0.9) + backdrop-blur）
 * - 右侧：主内容区，继承全局深色背景
 * - 移动端（<768px）：侧边栏隐藏，通过汉堡菜单触发滑出
 */

const store = useAuthStore()
const { logout } = useAuth()
const route = useRoute()

// ── 侧边栏展开状态（仅移动端使用） ──
const sidebarOpen = ref(false)

// 路由切换时自动关闭移动端侧边栏
watch(() => route.fullPath, () => {
  sidebarOpen.value = false
})

function closeSidebarOnMobile() {
  // 仅在移动端（<768px）关闭侧边栏
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

const roleColors: Record<string, string> = {
  system_admin: 'error',
  admin: 'primary',
  subaccount: 'warning',
  individual: 'neutral',
}

const roleLabel = computed(() => roleLabels[store.user?.role ?? ''] ?? '')
const roleColor = computed(() => roleColors[store.user?.role ?? ''] ?? 'neutral')

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
        { label: '仪表盘', icon: 'i-lucide-layout-dashboard', to: '/home' },
        { label: '团队管理', icon: 'i-lucide-users', to: '/teams' },
      ]
    case 'admin':
    case 'subaccount':
      return [
        { label: '仪表盘', icon: 'i-lucide-layout-dashboard', to: '/home' },
        { label: '赛事管理', icon: 'i-lucide-swords', to: '/tournaments/manage' },
        { label: '创建赛事', icon: 'i-lucide-plus-circle', to: '/tournaments/create' },
        // 仅 qq_bot 模式下显示机器人管理
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

/**
 * 判断当前路由是否匹配导航项
 * 首页 "/home" 需精确匹配，其他路由前缀匹配即可
 */
function isActive(to: string): boolean {
  if (to === '/home') {
    return route.path === '/home'
  }
  return route.path.startsWith(to)
}
</script>

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

/* 性能优化：侧边栏滑出动画使用 transform 而非 left/width，触发 GPU 合成层
   will-change 提示浏览器预先创建合成层，避免动画期间的主线程重绘 */
.sidebar {
  will-change: transform;
  /* 隔离侧边栏渲染，避免影响主内容区 */
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
