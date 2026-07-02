<script setup lang="ts">
const toast = useToast()
const { createStandaloneMatch } = useTournament()

const form = reactive({ name: '', description: '', scheduledAt: '' })
const loading = ref(false)

async function handleCreate() {
  if (!form.name) { toast.add({ title: '请输入赛事名称', color: 'error' }); return }
  loading.value = true
  try {
    const result = await createStandaloneMatch({
      name: form.name,
      description: form.description || undefined,
      scheduledAt: form.scheduledAt || undefined,
    })
    toast.add({ title: '独立赛事创建成功', color: 'success' })
    await navigateTo(`/standalone/${result.id}`)
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '创建失败', color: 'error' })
  } finally { loading.value = false }
}
</script>

<template>
  <!-- 最外层容器 -->
  <div class="min-h-screen">
    <div class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 fade-in">
      <h1 class="text-2xl font-bold text-white mb-6">创建独立赛事</h1>
      <!-- 玻璃拟态卡片 -->
      <div class="glass-card-strong p-6 sm:p-8">
        <div class="space-y-4">
          <UFormField label="赛事名称" required>
            <UInput v-model="form.name" placeholder="如：辩论练习赛" />
          </UFormField>
          <UFormField label="备注">
            <UTextarea v-model="form.description" placeholder="赛事备注（可选）" :rows="3" />
          </UFormField>
          <UFormField label="比赛时间">
            <UInput v-model="form.scheduledAt" type="datetime-local" />
          </UFormField>
          <UButton color="primary" block :loading="loading" @click="handleCreate">
            {{ loading ? '创建中...' : '创建独立赛事' }}
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
