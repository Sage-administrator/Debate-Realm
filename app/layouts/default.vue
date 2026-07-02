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
        // 移动端默认隐藏，打开时滑入
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      ]"
    >
      <!-- ── Logo 区域 ── -->
      <div class="flex items-center gap-3 px-6 py-5">
        <!-- 渐变圆角方块图标 -->
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
            <!-- SSR / 加载占位 -->
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
              <!-- 用户头像占位 -->
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
        <!-- 右侧留空保持对称 -->
        <div class="w-9" />
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
        { label: '仪表盘', icon: 'i-lucide-layout-dashboard', to: '/' },
        { label: '团队管理', icon: 'i-lucide-users', to: '/teams' },
      ]
    case 'admin':
    case 'subaccount':
      return [
        { label: '仪表盘', icon: 'i-lucide-layout-dashboard', to: '/' },
        { label: '赛事管理', icon: 'i-lucide-swords', to: '/tournaments/create' },
        // 仅 qq_bot 模式下显示机器人管理
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
</script>

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
