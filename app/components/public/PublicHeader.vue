<script setup lang="ts">
// 公开页面统一顶部导航（与公开首页 index.vue 视觉一致）
// - 已登录显示「进入仪表盘」(跳转 /home)
// - 未登录显示「登录」(跳转 /login)
// - 通过 #actions slot 注入页面专属按钮（如赛事列表页的「创建赛事」）
const store = useAuthStore()
</script>

<template>
  <header
    class="fixed top-0 left-0 right-0 z-50 bg-[var(--color-bg-secondary)] backdrop-blur-md border-b border-[var(--color-border)]"
  >
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <!-- Logo -->
        <NuxtLink to="/" class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20"
          >
            <UIcon name="i-lucide-trophy" class="w-5 h-5 text-white" />
          </div>
          <div class="flex flex-col leading-tight">
            <span class="text-lg font-bold text-[var(--color-text-primary)] tracking-wide"
              >辩境</span
            >
            <span class="text-[10px] text-[var(--color-text-muted)]">DebateRealm</span>
          </div>
        </NuxtLink>

        <!-- 右上角操作 -->
        <div class="flex items-center gap-3">
          <slot name="actions" />
          <NuxtLink
            :to="store.isAuthenticated ? '/home' : '/login'"
            class="btn-primary text-sm px-5 py-2 flex items-center gap-2"
          >
            <UIcon
              :name="store.isAuthenticated ? 'i-lucide-layout-dashboard' : 'i-lucide-log-in'"
              class="w-4 h-4"
            />
            <span>{{ store.isAuthenticated ? '进入仪表盘' : '登录' }}</span>
          </NuxtLink>
        </div>
      </div>
    </div>
  </header>
</template>
