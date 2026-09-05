<script setup lang="ts">
// 正式赛事计时大屏：薄适配器，仅注入宿主参数；全部运行时逻辑收敛在 TimerRunner
definePageMeta({ ssr: false, layout: false })

import { computed } from 'vue'
import { useRoute } from '#imports'

const route = useRoute()
const hostId = computed(() => route.params.id as string)
</script>

<template>
  <TimerRunner host-type="tournament" :host-id="hostId" :show-setup-panel="true" />
</template>
