/**
 * useSidebarLayout — 侧边栏布局共享 composable
 *
 * 消除 default.vue / tournament.vue / standalone.vue 三个 layout 的重复代码：
 * - 侧边栏展开/关闭状态管理
 * - 角色标签映射
 * - 导航项动态生成
 * - 路由匹配判断
 * - 退出登录
 */
export interface NavItem {
  label: string
  icon: string
  to: string
}

export interface SidebarLayoutConfig {
  /** 仪表盘路径，default.vue 和 tournament.vue 用 '/home'，standalone 用 '/' */
  dashboardPath?: string
  /** 是否在 admin/subaccount 导航中显示「创建赛事」入口，default.vue 为 true */
  includeTournamentCreate?: boolean
  /** 是否允许 bot 管理入口（standalone 为 false） */
  includeBotManagement?: boolean
  /** 自定义 navItems 覆盖（如提供则忽略自动生成逻辑） */
  customNavItems?: () => NavItem[]
}

export function useSidebarLayout(config: SidebarLayoutConfig = {}) {
  const {
    dashboardPath = '/home',
    includeTournamentCreate = true,
    includeBotManagement = true,
    customNavItems,
  } = config

  const store = useAuthStore()
  const { logout } = useAuth()
  const route = useRoute()

  // ── 侧边栏展开状态（仅移动端使用） ──
  const sidebarOpen = ref(false)

  // 路由切换时自动关闭移动端侧边栏
  watch(
    () => route.fullPath,
    () => {
      sidebarOpen.value = false
    },
  )

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
  const navItems = computed<NavItem[]>(() => {
    if (customNavItems) return customNavItems()

    const role = store.user?.role ?? ''
    const mode = store.user?.mode ?? ''

    switch (role) {
      case 'system_admin':
        return [
          { label: '仪表盘', icon: 'i-lucide-layout-dashboard', to: dashboardPath },
          { label: '团队管理', icon: 'i-lucide-users', to: '/teams' },
        ]
      case 'admin':
      case 'subaccount': {
        const items: NavItem[] = [
          { label: '仪表盘', icon: 'i-lucide-layout-dashboard', to: dashboardPath },
          { label: '赛事管理', icon: 'i-lucide-swords', to: '/tournaments/manage' },
        ]
        if (includeTournamentCreate) {
          items.push({ label: '创建赛事', icon: 'i-lucide-plus-circle', to: '/tournaments/create' })
        }
        if (includeBotManagement && mode === 'qq_bot') {
          items.push({ label: '机器人管理', icon: 'i-lucide-bot', to: '/bot' })
        }
        return items
      }
      case 'individual':
        return [
          { label: '个人中心', icon: 'i-lucide-user', to: dashboardPath },
          { label: '创建赛事', icon: 'i-lucide-plus-circle', to: '/standalone/create' },
        ]
      default:
        return []
    }
  })

  // ── 路由激活判断 ──
  function isActive(to: string): boolean {
    if (to === dashboardPath) {
      return route.path === dashboardPath
    }
    return route.path.startsWith(to)
  }

  return {
    sidebarOpen,
    closeSidebarOnMobile,
    roleLabel,
    navItems,
    isActive,
    logout,
  }
}
