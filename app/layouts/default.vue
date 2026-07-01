<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- 顶部导航 -->
    <header class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-14">
          <NuxtLink to="/" class="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
            <UIcon name="i-lucide-timer" class="w-6 h-6 text-primary" />
            <span class="text-lg font-bold">辩论计时器</span>
          </NuxtLink>
          <!-- 用户信息区域 - 使用 ClientOnly 避免 SSR 水合不匹配 -->
          <ClientOnly>
            <div class="flex items-center gap-4">
              <UBadge
                :label="roleLabel"
                :color="roleColor as any"
                variant="soft"
                size="sm"
              />
              <UDropdownMenu :items="userMenuItems">
                <UButton color="neutral" variant="ghost" size="sm">
                  {{ store.user?.username }}
                  <template #trailing>
                    <UIcon name="i-lucide-chevron-down" class="w-4 h-4" />
                  </template>
                </UButton>
              </UDropdownMenu>
            </div>
            <template #fallback>
              <div class="flex items-center gap-4">
                <div class="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div class="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            </template>
          </ClientOnly>
        </div>
      </div>
    </header>

    <!-- 主体内容 -->
    <main>
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const store = useAuthStore()
const { logout } = useAuth()

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

const userMenuItems = [
  [
    { label: '个人设置', icon: 'i-lucide-settings', to: '/profile' },
    { label: '退出登录', icon: 'i-lucide-log-out', onSelect: () => logout() },
  ],
]
</script>
