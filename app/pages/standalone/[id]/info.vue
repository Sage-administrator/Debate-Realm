<script setup lang="ts">
definePageMeta({ layout: 'standalone' })

// 独立赛事信息编辑页面
const route = useRoute()
const toast = useToast()
const { getStandaloneMatch, updateStandaloneMatch, deleteStandaloneMatch } = useTournament()

const standaloneMatch = inject<Ref<any>>('standaloneMatch')!
const matchId = computed(() => route.params.id as string)

// ── 编辑状态 ──
const editingInfo = ref(false)
const infoForm = reactive({
  name: '',
  description: '',
  status: 'pending',
  venue: '',
})
const savingInfo = ref(false)
const deleting = ref(false)

// ── 初始化表单数据 ──
watchEffect(() => {
  if (standaloneMatch.value) {
    infoForm.name = standaloneMatch.value.name || ''
    infoForm.description = standaloneMatch.value.description || ''
    infoForm.status = standaloneMatch.value.status || 'pending'
    infoForm.venue = standaloneMatch.value.venue || ''
  }
})

// ── 更新赛事信息 ──
async function handleUpdateInfo() {
  if (!infoForm.name.trim()) {
    toast.add({ title: '赛事名称不能为空', color: 'error' })
    return
  }
  savingInfo.value = true
  try {
    await updateStandaloneMatch(matchId.value, {
      name: infoForm.name.trim(),
      description: infoForm.description.trim(),
      status: infoForm.status,
      venue: infoForm.venue.trim() || null,
    })
    toast.add({ title: '赛事信息已更新', color: 'success' })
    editingInfo.value = false
    // 刷新数据
    const updated = await getStandaloneMatch(matchId.value)
    standaloneMatch.value = updated
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '更新失败', color: 'error' })
  } finally {
    savingInfo.value = false
  }
}

// ── 删除赛事 ──
async function handleDeleteMatch() {
  if (!confirm('确定要删除此赛事吗？此操作不可撤销。')) return
  deleting.value = true
  try {
    await deleteStandaloneMatch(matchId.value)
    toast.add({ title: '赛事已删除', color: 'success' })
    standaloneMatch.value = null
    await navigateTo('/', { replace: true })
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '删除失败', color: 'error' })
  } finally {
    deleting.value = false
  }
}

// ── 工具函数 ──
const statusLabel = (s: string) => ({ pending: '待开始', running: '进行中', finished: '已完成' }[s] || s)
const statusColor = (s: string): any => ({ pending: 'neutral', running: 'primary', finished: 'success' }[s] || 'neutral')
</script>

<template>
  <template v-if="standaloneMatch">
  <!-- ═══ 比赛信息内容 ═══ -->
  <div class="py-6 space-y-6">
    <!-- 赛事信息编辑 -->
    <UCard class="mb-6">
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            <UIcon name="i-lucide-file-text" class="w-4 h-4 text-[var(--color-text-muted)]" />
            比赛信息
          </h2>
        <button
          v-if="!editingInfo"
          class="flex items-center gap-1 px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
          @click="() => { editingInfo = true }"
        >
          <UIcon name="i-lucide-pencil" class="w-3.5 h-3.5" />编辑
        </button>
        </div>
      </template>

      <!-- 查看模式 -->
      <div v-if="!editingInfo" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs text-[var(--color-text-muted)] mb-1">赛事名称</label>
            <p class="text-sm text-[var(--color-text-primary)]">{{ standaloneMatch.name }}</p>
          </div>
          <div>
            <label class="block text-xs text-[var(--color-text-muted)] mb-1">状态</label>
            <UBadge :label="statusLabel(standaloneMatch.status)" :color="statusColor(standaloneMatch.status)" size="xs" variant="soft" />
          </div>
          <div>
            <label class="block text-xs text-[var(--color-text-muted)] mb-1">举办地点</label>
            <p class="text-sm text-[var(--color-text-primary)]">{{ standaloneMatch.venue || '未设置' }}</p>
          </div>
          <div>
            <label class="block text-xs text-[var(--color-text-muted)] mb-1">计划时间</label>
            <p class="text-sm text-[var(--color-text-primary)]">
              {{ standaloneMatch.scheduledAt ? new Date(standaloneMatch.scheduledAt).toLocaleDateString('zh-CN') : '未设置' }}
            </p>
          </div>
          <div>
            <label class="block text-xs text-[var(--color-text-muted)] mb-1">创建时间</label>
            <p class="text-sm text-[var(--color-text-primary)]">{{ new Date(standaloneMatch.createdAt).toLocaleDateString('zh-CN') }}</p>
          </div>
          <div>
            <label class="block text-xs text-[var(--color-text-muted)] mb-1">场次数量</label>
            <p class="text-sm text-[var(--color-text-primary)]">{{ standaloneMatch.matches?.length || 0 }} 场</p>
          </div>
        </div>
        <div>
          <label class="block text-xs text-[var(--color-text-muted)] mb-1">描述</label>
          <p class="text-sm text-[var(--color-text-primary)]">{{ standaloneMatch.description || '无' }}</p>
        </div>
      </div>

      <!-- 编辑模式 -->
      <div v-else class="space-y-4">
        <div>
          <label class="block text-sm text-[var(--color-text-primary)] mb-1.5">赛事名称 <span class="text-red-500">*</span></label>
          <input
            v-model="infoForm.name" type="text"
            class="input-glass w-full h-10 px-3 text-sm border border-[var(--color-border)] rounded focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/20 transition-colors"
          />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm text-[var(--color-text-primary)] mb-1.5">状态</label>
            <USelect
              v-model="infoForm.status"
              :items="[
                { label: '待开始', value: 'pending' },
                { label: '进行中', value: 'running' },
                { label: '已完成', value: 'finished' },
              ]"
              class="w-full"
              :ui="{ base: 'input-glass' }"
            />
          </div>
          <div>
            <label class="block text-sm text-[var(--color-text-primary)] mb-1.5">举办地点</label>
            <input
              v-model="infoForm.venue" type="text" placeholder="如：301教室"
              class="input-glass w-full h-10 px-3 text-sm border border-[var(--color-border)] rounded focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/20 transition-colors"
            />
          </div>
        </div>
        <div>
          <label class="block text-sm text-[var(--color-text-primary)] mb-1.5">描述</label>
          <textarea
            v-model="infoForm.description" rows="3" placeholder="赛事描述、扩展信息等"
            class="input-glass w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/20 transition-colors resize-none"
          />
        </div>
        <div class="flex gap-3 pt-2">
          <UButton color="primary" size="sm" :loading="savingInfo" @click="handleUpdateInfo">
            <UIcon name="i-lucide-check" class="w-3.5 h-3.5 mr-1" />保存修改
          </UButton>
          <UButton color="neutral" variant="outline" size="sm" @click="() => { editingInfo = false }">
            取消
          </UButton>
        </div>
      </div>
    </UCard>

    <!-- 危险操作区 -->
    <UCard class="mb-6 border border-red-500/30">
      <template #header>
        <h3 class="text-sm font-semibold text-red-500 dark:text-red-400 flex items-center gap-2">
          <UIcon name="i-lucide-alert-triangle" class="w-4 h-4" />危险操作
        </h3>
      </template>
      <p class="text-xs text-[var(--color-text-muted)] mb-3">删除赛事将同时删除所有关联数据，不可恢复。</p>
      <UButton color="error" size="sm" :loading="deleting" @click="handleDeleteMatch">
        {{ deleting ? '删除中...' : '删除此赛事' }}
      </UButton>
    </UCard>
  </div>
  </template>
</template>