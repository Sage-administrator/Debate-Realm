<script setup lang="ts">
// 单场计时大屏：薄适配器，仅注入宿主参数；全部运行时逻辑收敛在 TimerRunner
definePageMeta({ ssr: false, layout: false })

import { computed } from 'vue'
import { useRoute } from '#imports'

const route = useRoute()
const hostId = computed(() => route.params.id as string)
</script>

<template>
  <TimerRunner host-type="standalone" :host-id="hostId" :show-setup-panel="false" />
</template>
