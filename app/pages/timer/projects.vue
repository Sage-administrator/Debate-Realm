<!--
  /pages/timer/projects.vue - 计时器项目管理列表
  功能：
  - 显示当前用户创建的所有计时器项目
  - 创建新项目
  - 进入计时器运行页面
  - 进入环节配置编辑页面
  - 删除项目
-->
<script setup lang="ts">
const authStore = useAuthStore()
const toast = useToast()

// 数据状态
const projects = ref<any[]>([])
const loading = ref(true)
const showCreateModal = ref(false)
const newProjectForm = reactive({
  name: '',
  title: '辩论赛',
})

// 加载项目列表
async function loadProjects() {
  loading.value = true
  try {
    projects.value = await $fetch<any[]>('/api/timer/projects', {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '加载失败', color: 'error' })
  } finally {
    loading.value = false
  }
}

// 创建新项目
async function createProject() {
  if (!newProjectForm.name.trim()) {
    toast.add({ title: '请输入项目名称', color: 'warning' })
    return
  }
  try {
    const res = await $fetch<any>('/api/timer/projects', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authStore.token}` },
      body: newProjectForm,
    })
    toast.add({ title: '创建成功', color: 'success' })
    showCreateModal.value = false
    newProjectForm.name = ''
    newProjectForm.title = '辩论赛'
    loadProjects()
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '创建失败', color: 'error' })
  }
}

// 删除项目
async function deleteProject(id: string, name: string) {
  if (!confirm(`确定要删除项目"${name}"吗？此操作不可撤销。`)) return
  try {
    await $fetch(`/api/timer/projects/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    toast.add({ title: '已删除', color: 'success' })
    loadProjects()
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '删除失败', color: 'error' })
  }
}

// 格式化时间显示
function formatDate(d: Date | string) {
  if (!d) return ''
  const date = typeof d === 'string' ? new Date(d) : d
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${h}:${min}`
}

onMounted(() => {
  loadProjects()
})
</script>

<template>
  <!-- 最外层容器 -->
  <div class="min-h-screen">
    <!-- 内容容器：居中布局 -->
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 fade-in">
      <!-- 页面标题 -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-[var(--color-text-primary)]">辩论赛计时器项目</h1>
          <p class="text-sm text-[var(--color-text-muted)] mt-1">管理您的辩论赛计时器配置</p>
        </div>
      <UButton color="primary" @click="() => { showCreateModal = true }">
        <UIcon name="i-lucide-plus" class="w-4 h-4 mr-1" />
        新建项目
      </UButton>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <UIcon name="i-lucide-loader-2" class="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400" />
    </div>

    <!-- 空状态 -->
    <div v-else-if="!projects.length" class="border border-[var(--color-border)] border-dashed rounded-lg p-12 text-center">
      <UIcon name="i-lucide-timer" class="w-12 h-12 mx-auto text-[var(--color-border-muted)] mb-3" />
      <p class="text-[var(--color-text-muted)] mb-4">暂无计时器项目，开始创建您的第一个辩论赛配置</p>
      <UButton color="primary" @click="() => { showCreateModal = true }">
        <UIcon name="i-lucide-plus" class="w-4 h-4 mr-1" />
        新建项目
      </UButton>
    </div>

    <!-- 项目列表 -->
    <div v-else class="grid gap-3">
      <div
        v-for="p in projects"
        :key="p.id"
        class="glass-card p-6"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <h3 class="font-bold text-lg text-[var(--color-text-primary)]">{{ p.name }}</h3>
            <p v-if="p.title" class="text-sm text-[var(--color-text-secondary)] mt-1">{{ p.title }}</p>

            <!-- 辩题信息 -->
            <div v-if="p.positiveTopic || p.negativeTopic" class="mt-2 text-sm space-y-1">
              <div v-if="p.positiveTopic" class="text-[var(--color-text-secondary)]">
                <span class="text-green-600 dark:text-green-400 font-medium">正方：</span>{{ p.positiveTopic }}
              </div>
              <div v-if="p.negativeTopic" class="text-[var(--color-text-secondary)]">
                <span class="text-blue-600 dark:text-blue-400 font-medium">反方：</span>{{ p.negativeTopic }}
              </div>
            </div>

            <!-- 环节数量 -->
            <div class="mt-2 text-xs text-[var(--color-text-muted)]">
              {{ p.stages?.length || 0 }} 个环节
              <span class="mx-1">·</span>
              更新于 {{ formatDate(p.updatedAt) }}
            </div>
          </div>

          <!-- 操作按钮 -->
          <div class="flex items-center gap-2 ml-4">
            <UButton color="primary" variant="soft" size="sm" :to="`/timer/run/${p.id}/timing`">
              <UIcon name="i-lucide-play" class="w-4 h-4 mr-1" />
              开始计时
            </UButton>
            <UButton color="neutral" variant="soft" size="sm" :to="`/timer/projects/${p.id}`">
              <UIcon name="i-lucide-pencil" class="w-4 h-4 mr-1" />
              编辑环节
            </UButton>
            <UButton color="error" variant="ghost" size="sm" @click="deleteProject(p.id, p.name)">
              <UIcon name="i-lucide-trash-2" class="w-4 h-4" />
            </UButton>
          </div>
        </div>
      </div>
    </div>

    <!-- 创建项目弹窗 -->
    <UModal v-model:open="showCreateModal" :class="'max-w-lg'">
      <template #content>
        <div class="glass-modal p-6 space-y-4">
        <h3 class="text-lg font-bold text-[var(--color-text-primary)]">新建计时器项目</h3>

        <div>
          <label class="block text-sm font-medium text-[var(--color-text-primary)] mb-1">项目名称</label>
          <UInput
            v-model="newProjectForm.name"
            placeholder="例：2024春季辩论赛"
            @keyup.enter="createProject"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-[var(--color-text-primary)] mb-1">比赛标题（显示用）</label>
          <UInput
            v-model="newProjectForm.title"
            placeholder="例：三社联合辩论赛"
            @keyup.enter="createProject"
          />
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <UButton color="neutral" variant="ghost" @click="() => { showCreateModal = false }">取消</UButton>
          <UButton color="primary" @click="createProject">
            创建
          </UButton>
        </div>
        </div>
      </template>
    </UModal>
  </div>
  </div>
</template>
