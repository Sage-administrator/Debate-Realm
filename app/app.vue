<!--
  ════════════════════════════════════════════════════
  app.vue — 应用根组件（严格限制多端登录）
  - 不在此处做多设备轮询（登录时已检测）
  - 其他设备在当前设备确认登录后会因 token 失效被自动踢下线
  ════════════════════════════════════════════════════
-->
<script setup lang="ts">
// 无需额外逻辑，认证管理通过 useAuth() / auth.client.ts 插件完成
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <!-- 全局 Toast（登录页用不到，但其他页面可能依赖） -->
    <ClientOnly>
      <UToaster />
    </ClientOnly>
  </div>
</template>
