<script setup lang="ts">
// ════════════════════════════════════════════════════
// 定时发布管理页 — 创建/编辑/启停定时发布辩论题目与讨论帖
// 仅 QQ 频道模式团队可用；发帖目标为「论坛」子频道（需私域机器人）
// ════════════════════════════════════════════════════
const store = useAuthStore()
const toast = useToast()

const isQQBotTeam = computed(() => store.user?.mode === 'qq_bot')

// ---------- 列表 ----------
const loading = ref(true)
const tasks = ref<any[]>([])

// ---------- 表单 ----------
const editingId = ref<string | null>(null)
const saving = ref(false)
const form = reactive({
  title: '',
  type: 'discussion' as 'debate' | 'discussion',
  content: '',
  channelId: '',
  tags: '',
  pollOptions: [] as string[],
  scheduleType: 'once' as 'once' | 'daily' | 'weekly',
  runAt: '', // datetime-local: "YYYY-MM-DDTHH:mm"（本地）
  timeHHMM: '09:00', // time: "HH:mm"
  weekday: 1, // 0-6 周日..周六
  timezone: 'Asia/Shanghai',
})

// ---------- 历史 ----------
const showHistory = ref(false)
const historyRuns = ref<any[]>([])
const historyLoading = ref(false)
const historyTitle = ref('')

const typeItems = [
  { label: '讨论话题', value: 'discussion' },
  { label: '辩论题目', value: 'debate' },
]
const scheduleItems = [
  { label: '单次', value: 'once' },
  { label: '每天', value: 'daily' },
  { label: '每周', value: 'weekly' },
]
const weekdayItems = [
  { label: '周日', value: 0 },
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
]

const statusMeta: Record<
  string,
  { label: string; color: 'info' | 'success' | 'neutral' | 'error' }
> = {
  pending: { label: '待发布', color: 'info' },
  published: { label: '已发布', color: 'success' },
  paused: { label: '已暂停', color: 'neutral' },
  failed: { label: '失败', color: 'error' },
}

// ---------- 工具 ----------
function formatZoned(iso: string | null, tz: string): string {
  if (!iso) return '-'
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: tz,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

// UTC ISO → 指定时区的 datetime-local 输入值
function utcToLocalInput(iso: string, tz: string): string {
  const d = new Date(iso)
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const m: Record<string, string> = {}
  for (const p of dtf.formatToParts(d)) if (p.type !== 'literal') m[p.type] = p.value
  return `${m.year}-${m.month}-${m.day}T${m.hour}:${m.minute}`
}

function resetForm() {
  editingId.value = null
  form.title = ''
  form.type = 'discussion'
  form.content = ''
  form.channelId = ''
  form.tags = ''
  form.pollOptions = []
  form.scheduleType = 'once'
  form.runAt = ''
  form.timeHHMM = '09:00'
  form.weekday = 1
  form.timezone = 'Asia/Shanghai'
}

// ---------- 加载 ----------
async function loadTasks() {
  loading.value = true
  try {
    const data = await $fetch<{ success: boolean; tasks: any[] }>('/api/scheduled-posts', {
      headers: { Authorization: `Bearer ${store.token}` },
    })
    tasks.value = data.tasks || []
  } catch (e: any) {
    toast.add({ title: e?.statusMessage || '加载失败', color: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(loadTasks)

// ---------- 编辑 ----------
function openEdit(task: any) {
  editingId.value = task.id
  form.title = task.title
  form.type = task.type
  form.content = task.content
  form.channelId = task.channelId
  form.tags = task.tags || ''
  form.pollOptions = task.pollOptions ? (JSON.parse(task.pollOptions) as string[]) : []
  form.scheduleType = task.scheduleType
  form.timezone = task.timezone || 'Asia/Shanghai'
  if (task.runAt) form.runAt = utcToLocalInput(task.runAt, form.timezone)
  else form.runAt = ''
  form.timeHHMM = task.timeHHMM || '09:00'
  form.weekday = task.weekday ?? 1
}

// ---------- 保存 ----------
async function saveTask() {
  if (!form.title.trim()) {
    toast.add({ title: '标题不能为空', color: 'warning' })
    return
  }
  if (!form.content.trim()) {
    toast.add({ title: '正文不能为空', color: 'warning' })
    return
  }
  if (!form.channelId.trim()) {
    toast.add({ title: '目标论坛子频道 ID 不能为空', color: 'warning' })
    return
  }
  if (form.scheduleType === 'once' && !form.runAt) {
    toast.add({ title: '请选择触发时间', color: 'warning' })
    return
  }
  if ((form.scheduleType === 'daily' || form.scheduleType === 'weekly') && !form.timeHHMM) {
    toast.add({ title: '请选择触发时间', color: 'warning' })
    return
  }

  saving.value = true
  const payload = {
    title: form.title.trim(),
    type: form.type,
    content: form.content.trim(),
    channelId: form.channelId.trim(),
    tags: form.tags,
    pollOptions: form.pollOptions.filter((o) => o.trim()),
    scheduleType: form.scheduleType,
    timezone: form.timezone,
    runAt: form.scheduleType === 'once' ? form.runAt : undefined,
    timeHHMM: form.scheduleType !== 'once' ? form.timeHHMM : undefined,
    weekday: form.scheduleType === 'weekly' ? form.weekday : undefined,
  }
  try {
    if (editingId.value) {
      await $fetch(`/api/scheduled-posts/${editingId.value}`, {
        method: 'PUT',
        body: payload,
        headers: { Authorization: `Bearer ${store.token}` },
      })
      toast.add({ title: '已更新任务', color: 'success' })
    } else {
      await $fetch('/api/scheduled-posts', {
        method: 'POST',
        body: payload,
        headers: { Authorization: `Bearer ${store.token}` },
      })
      toast.add({ title: '已创建任务', color: 'success' })
    }
    resetForm()
    await loadTasks()
  } catch (e: any) {
    toast.add({ title: e?.statusMessage || '保存失败', color: 'error' })
  } finally {
    saving.value = false
  }
}

// ---------- 启停 ----------
async function toggleTask(task: any) {
  try {
    await $fetch(`/api/scheduled-posts/${task.id}/toggle`, {
      method: 'POST',
      body: { paused: task.status !== 'paused' },
      headers: { Authorization: `Bearer ${store.token}` },
    })
    toast.add({ title: task.status === 'paused' ? '已恢复' : '已暂停', color: 'info' })
    await loadTasks()
  } catch (e: any) {
    toast.add({ title: e?.statusMessage || '操作失败', color: 'error' })
  }
}

// ---------- 删除 ----------
async function deleteTask(task: any) {
  if (!confirm(`确定删除任务「${task.title}」？`)) return
  try {
    await $fetch(`/api/scheduled-posts/${task.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${store.token}` },
    })
    toast.add({ title: '已删除', color: 'success' })
    await loadTasks()
  } catch (e: any) {
    toast.add({ title: e?.statusMessage || '删除失败', color: 'error' })
  }
}

// ---------- 历史 ----------
async function openHistory(task: any) {
  showHistory.value = true
  historyTitle.value = task.title
  historyLoading.value = true
  historyRuns.value = []
  try {
    const data = await $fetch<{ success: boolean; runs: any[] }>(
      `/api/scheduled-posts/${task.id}/runs`,
      {
        headers: { Authorization: `Bearer ${store.token}` },
      },
    )
    historyRuns.value = data.runs || []
  } catch (e: any) {
    toast.add({ title: e?.statusMessage || '加载历史失败', color: 'error' })
  } finally {
    historyLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- 标题 -->
      <div class="mb-6 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-calendar-clock" class="w-8 h-8 text-primary" />
          <h1 class="text-2xl font-bold">定时发布</h1>
        </div>
        <UButton as="NuxtLink" to="/bot" variant="ghost" size="sm" icon="i-lucide-arrow-left">
          返回机器人管理
        </UButton>
      </div>

      <!-- 非 QQ 频道团队 -->
      <div v-if="!isQQBotTeam" class="text-center py-12">
        <UIcon name="i-lucide-bot" class="w-16 h-16 mx-auto mb-4 text-[var(--color-text-muted)]" />
        <p class="text-[var(--color-text-muted)]">
          当前团队不是 QQ 频道模式，定时发布仅限 QQ 频道模式团队使用。
        </p>
      </div>

      <template v-else>
        <!-- 新建/编辑表单 -->
        <UCard class="mb-6">
          <template #header>
            <h2 class="font-bold">{{ editingId ? '编辑任务' : '新建定时发布任务' }}</h2>
          </template>
          <div class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <UFormField label="类型">
                <USelect v-model="form.type" :items="typeItems" />
              </UFormField>
              <UFormField label="标题" required>
                <UInput v-model="form.title" placeholder="如：本周辩论题目" />
              </UFormField>
            </div>

            <UFormField label="正文（支持 Markdown）" required>
              <UTextarea
                v-model="form.content"
                :rows="4"
                placeholder="辩论题目内容 / 讨论话题描述"
              />
            </UFormField>

            <UFormField
              label="目标论坛子频道 ID"
              required
              hint="发帖将发布到该 QQ 论坛子频道（需私域机器人）"
            >
              <UInput v-model="form.channelId" placeholder="论坛子频道 ID" />
            </UFormField>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <UFormField label="标签" hint="逗号分隔，如：辩题,本周">
                <UInput v-model="form.tags" placeholder="可选" />
              </UFormField>
              <UFormField label="时区" hint="用于准确计算触发时间">
                <UInput v-model="form.timezone" placeholder="Asia/Shanghai" />
              </UFormField>
            </div>

            <!-- 投票选项 -->
            <UFormField label="投票选项" hint="附加选项，将作为列表附在帖子正文">
              <div class="space-y-2">
                <div v-for="(opt, i) in form.pollOptions" :key="i" class="flex items-center gap-2">
                  <UInput v-model="form.pollOptions[i]" placeholder="选项内容" class="flex-1" />
                  <UButton
                    color="error"
                    variant="ghost"
                    size="xs"
                    icon="i-lucide-x"
                    @click="void form.pollOptions.splice(i, 1)"
                  />
                </div>
                <UButton
                  variant="soft"
                  size="xs"
                  icon="i-lucide-plus"
                  @click="void form.pollOptions.push('')"
                >
                  添加选项
                </UButton>
              </div>
            </UFormField>

            <!-- 调度 -->
            <UFormField label="调度方式">
              <USelect v-model="form.scheduleType" :items="scheduleItems" />
            </UFormField>

            <UFormField v-if="form.scheduleType === 'once'" label="触发时间" required>
              <BaseDateTimePicker v-model="form.runAt" mode="datetime" placeholder="选择触发时间" />
            </UFormField>

            <div v-if="form.scheduleType !== 'once'" class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <UFormField label="触发时间" required>
                <BaseDateTimePicker v-model="form.timeHHMM" mode="time" placeholder="选择时间" />
              </UFormField>
              <UFormField v-if="form.scheduleType === 'weekly'" label="星期">
                <USelect v-model="form.weekday" :items="weekdayItems" />
              </UFormField>
            </div>

            <div class="flex gap-2">
              <UButton color="primary" :loading="saving" @click="saveTask">
                {{ editingId ? '保存修改' : '创建任务' }}
              </UButton>
              <UButton v-if="editingId" variant="ghost" @click="resetForm">取消编辑</UButton>
            </div>
          </div>
        </UCard>

        <!-- 任务列表 -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h2 class="font-bold">定时任务</h2>
              <UButton
                variant="ghost"
                size="xs"
                icon="i-lucide-refresh-cw"
                :loading="loading"
                @click="loadTasks"
              />
            </div>
          </template>

          <div v-if="loading" class="text-center py-6">
            <UIcon name="i-lucide-loader" class="w-5 h-5 animate-spin mx-auto" />
          </div>
          <div
            v-else-if="tasks.length === 0"
            class="text-[var(--color-text-muted)] text-sm py-4 text-center"
          >
            暂无定时任务。在上方创建第一个定时发布任务吧。
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="task in tasks"
              :key="task.id"
              class="p-3 rounded border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-medium truncate">{{ task.title }}</span>
                    <UBadge
                      :label="task.type === 'debate' ? '辩论题目' : '讨论话题'"
                      size="xs"
                      variant="soft"
                    />
                    <UBadge
                      :label="statusMeta[task.status]?.label || task.status"
                      :color="statusMeta[task.status]?.color || 'neutral'"
                      size="xs"
                      variant="solid"
                    />
                  </div>
                  <div class="text-xs text-[var(--color-text-muted)] mt-1 space-y-0.5">
                    <div>
                      子频道：<span class="font-mono">{{ task.channelId }}</span>
                    </div>
                    <div>
                      下次触发：{{
                        formatZoned(
                          task.nextRunAt ? new Date(task.nextRunAt).toISOString() : null,
                          task.timezone,
                        )
                      }}
                    </div>
                    <div
                      v-if="task.lastResult"
                      :class="task.status === 'failed' ? 'text-red-500' : ''"
                    >
                      最近结果：{{ task.lastResult }}
                    </div>
                  </div>
                </div>
                <div class="flex flex-col gap-1 shrink-0">
                  <UButton
                    size="xs"
                    :color="task.status === 'paused' ? 'success' : 'neutral'"
                    :variant="task.status === 'paused' ? 'solid' : 'outline'"
                    :disabled="task.status === 'published' || task.status === 'failed'"
                    @click="toggleTask(task)"
                  >
                    {{ task.status === 'paused' ? '恢复' : '暂停' }}
                  </UButton>
                  <UButton size="xs" variant="ghost" icon="i-lucide-eye" @click="openHistory(task)"
                    >历史</UButton
                  >
                  <UButton size="xs" variant="ghost" icon="i-lucide-edit" @click="openEdit(task)"
                    >编辑</UButton
                  >
                  <UButton
                    size="xs"
                    variant="ghost"
                    color="error"
                    icon="i-lucide-trash"
                    @click="deleteTask(task)"
                    >删除</UButton
                  >
                </div>
              </div>
            </div>
          </div>
        </UCard>
      </template>
    </div>

    <!-- 历史弹窗 -->
    <UModal v-model:open="showHistory">
      <template #content>
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="font-bold">发布历史 — {{ historyTitle }}</h3>
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-x"
                @click="void (showHistory = false)"
              />
            </div>
          </template>
          <div v-if="historyLoading" class="text-center py-6">
            <UIcon name="i-lucide-loader" class="w-5 h-5 animate-spin mx-auto" />
          </div>
          <div
            v-else-if="historyRuns.length === 0"
            class="text-[var(--color-text-muted)] text-sm py-4 text-center"
          >
            暂无发布记录。
          </div>
          <div v-else class="space-y-1.5 max-h-96 overflow-y-auto">
            <div
              v-for="run in historyRuns"
              :key="run.id"
              class="flex items-center gap-2 p-2 rounded text-sm hover:bg-[var(--color-bg-secondary)]"
            >
              <UBadge
                :label="run.status === 'success' ? '成功' : '失败'"
                :color="run.status === 'success' ? 'success' : 'error'"
                size="xs"
                variant="soft"
              />
              <span class="font-mono text-xs text-[var(--color-text-muted)] shrink-0">
                {{ new Date(run.runAt).toLocaleString() }}
              </span>
              <span class="truncate flex-1 min-w-0 text-xs">{{ run.message || '' }}</span>
            </div>
          </div>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
