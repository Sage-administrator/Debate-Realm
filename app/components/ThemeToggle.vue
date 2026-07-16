<template>
  <!-- ════════════════════════════════════════════════
       主题切换组件（简约风格）
       ponytail: 最小可用代码，无多余依赖
       ════════════════════════════════════════════════ -->
  <button
    class="theme-toggle flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200 hover:bg-[var(--color-bg-tertiary)]"
    @click="toggleTheme"
    :aria-label="isDark ? '切换到浅色模式' : '切换到深色模式'"
  >
    <!-- 月亮图标（深色模式显示） -->
    <UIcon
      v-if="isDark"
      name="i-lucide-moon"
      class="w-[18px] h-[18px] text-[var(--color-text-secondary)]"
    />
    <!-- 太阳图标（浅色模式显示） -->
    <UIcon
      v-else
      name="i-lucide-sun"
      class="w-[18px] h-[18px] text-[var(--color-text-secondary)]"
    />
  </button>
</template>

<script setup lang="ts">
/**
 * ThemeToggle.vue — 主题切换组件
 * - 简约图标按钮设计
 * - 太阳/月亮图标切换
 * - hover 仅改变背景，不改变文字颜色
 */

const { resolvedTheme, toggleTheme } = useTheme()

const isDark = computed(() => resolvedTheme.value === 'dark')
</script>

<style scoped>
/* ════════════════════════════════════════════════
   主题切换按钮样式
   ════════════════════════════════════════════════ */

.theme-toggle {
  border: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
  cursor: pointer;
}

.theme-toggle:hover {
  border-color: var(--color-text-muted);
}

.theme-toggle:active {
  transform: scale(0.95);
}

.theme-toggle:focus {
  outline: none;
}

.theme-toggle:focus-visible {
  box-shadow: 0 0 0 2px var(--color-accent-primary);
}
</style>
