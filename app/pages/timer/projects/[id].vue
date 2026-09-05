<!--
  /pages/timer/projects/[id].vue - 计时器项目环节配置编辑页面
  功能：
  - 编辑项目基本信息（名称、标题、队伍、辩题）
  - 添加/删除/调整环节
  - 配置每个环节的类型和时长
  - 保存更新
-->
<script setup lang="ts">
const authStore = useAuthStore()
const toast = useToast()
const route = useRoute()
const router = useRouter()

const projectId = computed(() => route.params.id as string)

// 页面状态
const loading = ref(true)
const saving = ref(false)
const project = ref<any>(null)

// 表单数据（从后端加载后存入）
const form = reactive({
  name: '',
  title: '',
  positiveTopic: '',
  negativeTopic: '',
  teamPositiveName: '',
  teamNegativeName: '',
  stages: [] as any[],
})

// ════════════════════════════════════════════════
// 1. 加载项目数据
// ════════════════════════════════════════════════
async function loadProject() {
  loading.value = true
  try {
    const res = await $fetch<any>(`/api/timer/projects/${projectId.value}`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    project.value = res.data

    // 填充表单
    form.name = res.data.name
    form.title = res.data.title
    form.positiveTopic = res.data.positiveTopic || ''
    form.negativeTopic = res.data.negativeTopic || ''
    form.teamPositiveName = res.data.teamPositiveName || ''
    form.teamNegativeName = res.data.teamNegativeName || ''
    form.stages = (res.data.stages || []).map((s: any) => ({
      ...s,
    }))
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '加载失败', color: 'error' })
  } finally {
    loading.value = false
  }
}

// ════════════════════════════════════════════════
// 2. 环节管理操作
// ════════════════════════════════════════════════

// 添加新环节
function addStage(type: string) {
  const newStage = {
    id: `new_${Date.now()}`, // 临时 ID，保存时后端会生成
    name: '新环节',
    duration: 180,
    type,
    description: '',
    order: form.stages.length,
    positiveDuration: type === 'dual-timer' ? 180 : null,
    negativeDuration: type === 'dual-timer' ? 180 : null,
  }

  // 根据类型设置默认名称
  if (type === 'speech') newStage.name = '立论'
  else if (type === 'question') newStage.name = '质询'
  else if (type === 'summary') newStage.name = '小结'
  else if (type === 'dual-timer') newStage.name = '自由辩论'
  else if (type === 'special') newStage.name = '开场/评委点评'

  form.stages.push(newStage)
}

// 删除环节
function removeStage(index: number) {
  if (!confirm('确定要删除这个环节吗？')) return
  form.stages.splice(index, 1)
  // 重新排序
  form.stages.forEach((s, idx) => {
    s.order = idx
  })
}

// 上移环节
function moveStageUp(index: number) {
  if (index <= 0) return
  const temp = form.stages[index]
  form.stages[index] = form.stages[index - 1]
  form.stages[index - 1] = temp
  form.stages.forEach((s, idx) => {
    s.order = idx
  })
}

// 下移环节
function moveStageDown(index: number) {
  if (index >= form.stages.length - 1) return
  const temp = form.stages[index]
  form.stages[index] = form.stages[index + 1]
  form.stages[index + 1] = temp
  form.stages.forEach((s, idx) => {
    s.order = idx
  })
}

// 插入常用模板
function insertDebateTemplate() {
  if (form.stages.length > 0 && !confirm('将替换当前环节列表为标准辩论赛模板，确定吗？')) return

  form.stages = [
    {
      id: `tpl_${Date.now()}_1`,
      name: '开场介绍',
      duration: 0,
      type: 'no_timer',
      description: '主持人介绍比赛规则',
      order: 0,
    },
    {
      id: `tpl_${Date.now()}_2`,
      name: '正方一辩立论',
      duration: 180,
      type: 'single_speech',
      description: '正方一辩进行开篇立论',
      order: 1,
    },
    {
      id: `tpl_${Date.now()}_3`,
      name: '反方二辩质询正方一辩',
      duration: 120,
      type: 'single_question',
      description: '反方二辩对正方一辩进行质询',
      order: 2,
    },
    {
      id: `tpl_${Date.now()}_4`,
      name: '反方一辩立论',
      duration: 180,
      type: 'single_speech',
      description: '反方一辩进行开篇立论',
      order: 3,
    },
    {
      id: `tpl_${Date.now()}_5`,
      name: '正方二辩质询反方一辩',
      duration: 120,
      type: 'single_question',
      description: '正方二辩对反方一辩进行质询',
      order: 4,
    },
    {
      id: `tpl_${Date.now()}_6`,
      name: '反方二辩质询小结',
      duration: 90,
      type: 'summary',
      description: '反方二辩就质询内容进行小结',
      order: 5,
    },
    {
      id: `tpl_${Date.now()}_7`,
      name: '正方二辩质询小结',
      duration: 90,
      type: 'summary',
      description: '正方二辩就质询内容进行小结',
      order: 6,
    },
    {
      id: `tpl_${Date.now()}_8`,
      name: '正反方四辩对辩',
      duration: 90,
      type: 'bilateral_debate',
      description: '正反方四辩进行对辩',
      order: 7,
      positiveDuration: 90,
      negativeDuration: 90,
    },
    {
      id: `tpl_${Date.now()}_9`,
      name: '正方三辩盘问',
      duration: 90,
      type: 'single_question',
      description: '正方三辩盘问反方',
      order: 8,
    },
    {
      id: `tpl_${Date.now()}_10`,
      name: '反方三辩盘问',
      duration: 90,
      type: 'single_question',
      description: '反方三辩盘问正方',
      order: 9,
    },
    {
      id: `tpl_${Date.now()}_11`,
      name: '正方三辩盘问小结',
      duration: 90,
      type: 'summary',
      description: '正方三辩小结',
      order: 10,
    },
    {
      id: `tpl_${Date.now()}_12`,
      name: '反方三辩盘问小结',
      duration: 90,
      type: 'summary',
      description: '反方三辩小结',
      order: 11,
    },
    {
      id: `tpl_${Date.now()}_13`,
      name: '自由辩论',
      duration: 240,
      type: 'free_debate',
      description: '双方自由辩论',
      order: 12,
      positiveDuration: 240,
      negativeDuration: 240,
    },
    {
      id: `tpl_${Date.now()}_14`,
      name: '反方四辩总结陈词',
      duration: 210,
      type: 'summary',
      description: '反方四辩进行总结陈词',
      order: 13,
    },
    {
      id: `tpl_${Date.now()}_15`,
      name: '正方四辩总结陈词',
      duration: 210,
      type: 'summary',
      description: '正方四辩进行总结陈词',
      order: 14,
    },
    {
      id: `tpl_${Date.now()}_16`,
      name: '评委点评',
      duration: 0,
      type: 'no_timer',
      description: '评委对比赛进行点评',
      order: 15,
    },
    {
      id: `tpl_${Date.now()}_17`,
      name: '公布结果',
      duration: 0,
      type: 'no_timer',
      description: '主持人公布比赛结果',
      order: 16,
    },
  ]

  toast.add({ title: '已应用标准辩论赛模板', color: 'success' })
}

// ════════════════════════════════════════════════
// 3. 保存项目
// ════════════════════════════════════════════════
async function saveProject() {
  // 保存项目：提交基本信息及所有环节配置（含排序、类型、时长），成功后重新加载
  if (!form.name.trim()) {
    toast.add({ title: '请输入项目名称', color: 'warning' })
    return
  }
  saving.value = true
  try {
    const body = {
      name: form.name,
      title: form.title,
      positiveTopic: form.positiveTopic || null,
      negativeTopic: form.negativeTopic || null,
      teamPositiveName: form.teamPositiveName || null,
      teamNegativeName: form.teamNegativeName || null,
      stages: form.stages.map((s, idx) => ({
        id: s.id,
        name: s.name,
        duration: Number(s.duration) || 0,
        type: s.type,
        description: s.description || null,
        order: idx,
        positiveDuration: s.type === 'dual-timer' ? Number(s.positiveDuration) || 0 : null,
        negativeDuration: s.type === 'dual-timer' ? Number(s.negativeDuration) || 0 : null,
        allowedRoles: s.allowedRoles || null,
      })),
    }

    await $fetch(`/api/timer/projects/${projectId.value}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${authStore.token}` },
      body,
    })

    toast.add({ title: '保存成功', color: 'success' })
    await loadProject()
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '保存失败', color: 'error' })
  } finally {
    saving.value = false
  }
}

// 获取环节类型的中文标签
function stageTypeLabel(type: string): string {
  switch (type) {
    case 'speech':
      return '单计时（立论）'
    case 'question':
      return '单计时（质询）'
    case 'summary':
      return '单计时（小结）'
    case 'dual-timer':
      return '双计时（对辩/自由辩论）'
    case 'special':
      return '无计时（开场/点评）'
    default:
      return type
  }
}

// 获取环节类型图标颜色
function stageTypeColor(type: string): string {
  switch (type) {
    case 'speech':
      return 'bg-blue-500'
    case 'question':
      return 'bg-orange-500'
    case 'summary':
      return 'bg-purple-500'
    case 'dual-timer':
      return 'bg-green-500'
    case 'special':
      return 'bg-gray-500'
    default:
      return 'bg-gray-400'
  }
}

// ════════════════════════════════════════════════
// 4. 生命周期
// ════════════════════════════════════════════════
onMounted(() => {
  loadProject()
})
</script>

<template>
  <!-- 最外层容器：页面背景 -->
  <div class="min-h-screen">
    <!-- 内容容器：居中布局 -->
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- 页面标题栏 -->
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-3">
          <NuxtLink
            to="/timer/projects"
            class="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
          >
            <UIcon name="i-lucide-arrow-left" class="w-5 h-5" />
          </NuxtLink>
          <div>
            <h1 class="text-xl font-bold">编辑项目</h1>
            <p class="text-sm text-[var(--color-text-muted)]">配置辩论赛的环节与时间</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <UButton color="neutral" variant="ghost" size="sm" :to="`/timer/run/${projectId}/timing`">
            <UIcon name="i-lucide-play" class="w-4 h-4 mr-1" />
            进入计时
          </UButton>
          <UButton color="primary" :loading="saving" size="sm" @click="saveProject">
            <UIcon name="i-lucide-save" class="w-4 h-4 mr-1" />
            保存
          </UButton>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="flex items-center justify-center py-16">
        <UIcon
          name="i-lucide-loader-2"
          class="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400"
        />
      </div>

      <template v-else>
        <!-- 项目基本信息 -->
        <UCard class="mb-6">
          <template #header>
            <h2 class="text-lg font-bold flex items-center gap-2">
              <UIcon name="i-lucide-file-text" class="w-5 h-5 text-[var(--color-text-muted)]" />
              基本信息
            </h2>
          </template>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium mb-1">项目名称</label>
              <input
                v-model="form.name"
                class="w-full px-3 py-2 border border-[var(--color-border)] rounded focus:ring-1 focus:ring-blue-600 focus:outline-none bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
                placeholder="例：2024春季辩论赛"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">比赛标题（显示用）</label>
              <input
                v-model="form.title"
                class="w-full px-3 py-2 border border-[var(--color-border)] rounded focus:ring-1 focus:ring-blue-600 focus:outline-none bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
                placeholder="例：三社联合辩论赛"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">正方队伍名称</label>
              <input
                v-model="form.teamPositiveName"
                class="w-full px-3 py-2 border border-[var(--color-border)] rounded focus:ring-1 focus:ring-blue-600 focus:outline-none bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
                placeholder="例：北京大学辩论队"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">反方队伍名称</label>
              <input
                v-model="form.teamNegativeName"
                class="w-full px-3 py-2 border border-[var(--color-border)] rounded focus:ring-1 focus:ring-blue-600 focus:outline-none bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
                placeholder="例：清华大学辩论队"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">正方辩题</label>
              <input
                v-model="form.positiveTopic"
                class="w-full px-3 py-2 border border-[var(--color-border)] rounded focus:ring-1 focus:ring-blue-600 focus:outline-none bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
                placeholder="例：顺境更有利于人的成长"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">反方辩题</label>
              <input
                v-model="form.negativeTopic"
                class="w-full px-3 py-2 border border-[var(--color-border)] rounded focus:ring-1 focus:ring-blue-600 focus:outline-none bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
                placeholder="例：逆境更有利于人的成长"
              />
            </div>
          </div>
        </UCard>

        <!-- 环节配置 -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-bold flex items-center gap-2">
                <UIcon
                  name="i-lucide-list-ordered"
                  class="w-5 h-5 text-[var(--color-text-muted)]"
                />
                环节配置（{{ form.stages.length }} 个环节）
              </h2>

              <div class="flex items-center gap-2">
                <UButton color="neutral" variant="soft" size="sm" @click="insertDebateTemplate">
                  <UIcon name="i-lucide-file-template" class="w-4 h-4 mr-1" />
                  应用标准模板
                </UButton>
              </div>
            </div>
          </template>

          <!-- 添加新环节按钮 -->
          <div class="flex flex-wrap gap-2 mb-6 pb-4 border-b border-[var(--color-border)]">
            <span class="text-sm text-[var(--color-text-muted)] mr-2 flex items-center"
              >添加新环节：</span
            >
            <UButton color="neutral" variant="soft" size="sm" @click="() => addStage('speech')">
              <span class="w-2 h-2 bg-blue-500 rounded-full mr-2 inline-block"></span>
              单计时（立论/小结）
            </UButton>
            <UButton color="neutral" variant="soft" size="sm" @click="() => addStage('question')">
              <span class="w-2 h-2 bg-orange-500 rounded-full mr-2 inline-block"></span>
              单计时（质询）
            </UButton>
            <UButton color="neutral" variant="soft" size="sm" @click="() => addStage('dual-timer')">
              <span class="w-2 h-2 bg-green-500 rounded-full mr-2 inline-block"></span>
              双计时（对辩/自由辩论）
            </UButton>
            <UButton color="neutral" variant="soft" size="sm" @click="() => addStage('special')">
              <span class="w-2 h-2 bg-gray-500 rounded-full mr-2 inline-block"></span>
              无计时（开场/点评）
            </UButton>
          </div>

          <!-- 空状态 -->
          <div v-if="!form.stages.length" class="text-center py-12 border border-dashed rounded-lg">
            <UIcon
              name="i-lucide-timer"
              class="w-10 h-10 mx-auto text-[var(--color-text-muted)] mb-2"
            />
            <p class="text-[var(--color-text-muted)] text-sm">
              暂无环节，点击上方按钮添加或应用模板
            </p>
          </div>

          <!-- 环节列表 -->
          <div v-else class="space-y-3">
            <div
              v-for="(stage, idx) in form.stages"
              :key="stage.id"
              class="border border-[var(--color-border)] rounded-lg p-4 hover:border-[var(--color-border)] transition"
            >
              <div class="flex items-start gap-3">
                <!-- 序号 -->
                <div
                  class="text-[var(--color-text-muted)] font-mono text-sm w-6 text-center pt-1 flex-shrink-0"
                >
                  {{ idx + 1 }}
                </div>

                <!-- 类型标识 -->
                <div class="flex-shrink-0 pt-1">
                  <div
                    :class="[stageTypeColor(stage.type), 'w-3 h-3 rounded-full']"
                    :title="stageTypeLabel(stage.type)"
                  ></div>
                </div>

                <!-- 主要配置 -->
                <div class="flex-1 grid grid-cols-12 gap-3">
                  <!-- 名称 -->
                  <div class="col-span-4">
                    <label class="block text-xs text-[var(--color-text-muted)] mb-1"
                      >环节名称</label
                    >
                    <input
                      v-model="stage.name"
                      class="w-full px-2 py-1.5 border border-[var(--color-border)] rounded text-sm focus:ring-1 focus:ring-blue-600 focus:outline-none bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
                    />
                  </div>

                  <!-- 类型 -->
                  <div class="col-span-3">
                    <label class="block text-xs text-[var(--color-text-muted)] mb-1">类型</label>
                    <USelect
                      v-model="stage.type"
                      :items="[
                        { label: '单计时（立论）', value: 'speech' },
                        { label: '单计时（质询）', value: 'question' },
                        { label: '单计时（小结）', value: 'summary' },
                        { label: '双计时（对辩/自由辩论）', value: 'dual-timer' },
                        { label: '无计时（开场/点评）', value: 'special' },
                      ]"
                      class="w-full"
                      :ui="{
                        base: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border-[var(--color-border)]',
                      }"
                    />
                  </div>

                  <!-- 时长 -->
                  <template v-if="stage.type === 'dual-timer'">
                    <div class="col-span-2">
                      <label class="block text-xs text-[var(--color-text-muted)] mb-1"
                        >正方时长(秒)</label
                      >
                      <input
                        type="number"
                        v-model.number="stage.positiveDuration"
                        class="w-full px-2 py-1.5 border border-[var(--color-border)] rounded text-sm focus:ring-1 focus:ring-blue-600 focus:outline-none bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] text-right"
                        min="0"
                        max="3600"
                      />
                    </div>
                    <div class="col-span-2">
                      <label class="block text-xs text-[var(--color-text-muted)] mb-1"
                        >反方时长(秒)</label
                      >
                      <input
                        type="number"
                        v-model.number="stage.negativeDuration"
                        class="w-full px-2 py-1.5 border border-[var(--color-border)] rounded text-sm focus:ring-1 focus:ring-blue-600 focus:outline-none bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] text-right"
                        min="0"
                        max="3600"
                      />
                    </div>
                  </template>

                  <template v-else-if="stage.type === 'special'">
                    <div class="col-span-4">
                      <label class="block text-xs text-[var(--color-text-muted)] mb-1">说明</label>
                      <div class="text-sm text-[var(--color-text-muted)] pt-1.5">
                        无计时环节，仅显示环节名称
                      </div>
                    </div>
                  </template>

                  <template v-else>
                    <div class="col-span-2">
                      <label class="block text-xs text-[var(--color-text-muted)] mb-1"
                        >时长(秒)</label
                      >
                      <input
                        type="number"
                        v-model.number="stage.duration"
                        class="w-full px-2 py-1.5 border border-[var(--color-border)] rounded text-sm focus:ring-1 focus:ring-blue-600 focus:outline-none bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] text-right"
                        min="0"
                        max="3600"
                      />
                    </div>
                    <div class="col-span-2">
                      <label class="block text-xs text-[var(--color-text-muted)] mb-1">换算</label>
                      <div class="text-sm text-[var(--color-text-muted)] pt-1.5">
                        {{ Math.floor((stage.duration || 0) / 60) }}分{{
                          (stage.duration || 0) % 60
                        }}秒
                      </div>
                    </div>
                  </template>

                  <!-- 描述 -->
                  <div class="col-span-12">
                    <label class="block text-xs text-[var(--color-text-muted)] mb-1"
                      >描述（可选）</label
                    >
                    <input
                      v-model="stage.description"
                      class="w-full px-2 py-1.5 border border-[var(--color-border)] rounded text-sm focus:ring-1 focus:ring-blue-600 focus:outline-none bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
                      placeholder="对此环节的简单说明"
                    />
                  </div>
                </div>

                <!-- 操作按钮 -->
                <div class="flex flex-col gap-1 flex-shrink-0">
                  <button
                    class="w-7 h-7 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] rounded transition"
                    :disabled="idx === 0"
                    @click="moveStageUp(idx)"
                    title="上移"
                  >
                    <UIcon name="i-lucide-chevron-up" class="w-4 h-4" />
                  </button>
                  <button
                    class="w-7 h-7 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] rounded transition"
                    :disabled="idx === form.stages.length - 1"
                    @click="moveStageDown(idx)"
                    title="下移"
                  >
                    <UIcon name="i-lucide-chevron-down" class="w-4 h-4" />
                  </button>
                  <button
                    class="w-7 h-7 flex items-center justify-center text-red-500 hover:text-red-600 dark:text-red-400 hover:bg-red-500/15 rounded transition"
                    @click="removeStage(idx)"
                    title="删除"
                  >
                    <UIcon name="i-lucide-trash-2" class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 底部保存按钮 -->
          <div
            class="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-[var(--color-border)]"
          >
            <UButton color="neutral" variant="ghost" :to="'/timer/projects'">取消</UButton>
            <UButton color="primary" :loading="saving" @click="saveProject"> 保存 </UButton>
          </div>
        </UCard>
      </template>
    </div>
  </div>
</template>
