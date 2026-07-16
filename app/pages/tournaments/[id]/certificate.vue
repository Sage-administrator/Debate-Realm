<script setup lang="ts">
// 使用 tournament 布局，继承三阶段导航
definePageMeta({ layout: 'tournament' })

const route = useRoute()
const tournamentId = computed(() => route.params.id as string)

// TODO: 荣誉证书功能待开发
// 主要功能：制作电子荣誉证书（颁奖 / 获奖凭证），支持模板选择与导出。
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8">
    <header class="mb-6">
      <h1 class="text-xl font-semibold text-[var(--color-text-primary)]">荣誉证书</h1>
      <p class="mt-1 text-sm text-[var(--color-text-muted)]">赛后统计 · 电子荣誉证书制作</p>
    </header>

    <!-- 占位提示：功能暂未开发 -->
    <div
      class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-6 py-16 text-center"
    >
      <UIcon name="i-lucide-award" class="h-12 w-12 text-[var(--color-text-faint)]" />
      <p class="text-base font-medium text-[var(--color-text-secondary)]">功能开发中</p>
      <p class="max-w-md text-sm text-[var(--color-text-muted)]">
        本页面为「荣誉证书」占位页，后续将支持制作与导出电子荣誉证书（颁奖 / 获奖凭证）。
      </p>
    </div>
  </div>
</template>
