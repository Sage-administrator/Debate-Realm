<script setup lang="ts">
// 旧「赛事概览」页已弃用：访问 /tournaments/[id]/ 时直接跳转到 /info 子页面
definePageMeta({ layout: 'tournament' })

const route = useRoute()
throw navigateTo(`/tournaments/${route.params.id}/info`, { replace: true })
</script>

<template>
  <!-- 立即重定向到 /info，不渲染任何内容 -->
</template>
