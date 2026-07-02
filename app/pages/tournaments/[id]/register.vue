<script setup lang="ts">
// 赛事公开报名页（无需登录即可访问）
const route = useRoute()
const toast = useToast()
const authStore = useAuthStore()
const { getRegistrationConfig, submitRegistration } = useRegistration()

const tournamentId = computed(() => route.params.id as string)
const loading = ref(false)
const config = ref<any>(null)
const submitting = ref(false)
const submitted = ref(false)

// ── 表单状态 ──
const regType = ref<'individual' | 'team'>('individual')
const form = reactive({
  teamName: '',
  submitterName: '',
  contactPhone: '',
  contactEmail: '',
  notes: '',
})
// 成员列表（个人报名仅 1 人，队伍报名可增减）
const members = ref<{ name: string; preferredPosition: string; experience: string }[]>([
  { name: '', preferredPosition: '不限', experience: '' },
])
// 自定义字段数据
const customData = reactive<Record<string, string>>({})

// ── 辩论赛职位选项 ──
const positionOptions = [
  { label: '不限', value: '不限' },
  { label: '一辩', value: '一辩' },
  { label: '二辩', value: '二辩' },
  { label: '三辩', value: '三辩' },
  { label: '四辩', value: '四辩' },
]

// ── 解析自定义字段的可选项（fieldOptions 为 JSON 字符串） ──
function parseFieldOptions(raw: string | null | undefined): { label: string; value: string }[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    // 兼容字符串数组与 {label,value} 数组两种格式
    if (Array.isArray(parsed)) {
      return parsed.map((item: any) =>
        typeof item === 'string' ? { label: item, value: item } : { label: item.label, value: item.value }
      )
    }
    return []
  } catch {
    // 非 JSON 时按逗号分隔处理
    return raw.split(',').map(s => s.trim()).filter(Boolean).map(s => ({ label: s, value: s }))
  }
}

// ── 字段是否适用于当前报名类型 ──
function fieldAppliesTo(field: any): boolean {
  if (!field.appliesTo || field.appliesTo === 'all') return true
  return field.appliesTo === regType.value
}

// 过滤后的可见自定义字段
const visibleFields = computed(() => {
  const fields = config.value?.fields || []
  return fields.filter((f: any) => fieldAppliesTo(f))
})

// ── 加载报名配置 ──
onMounted(async () => {
  try {
    config.value = await getRegistrationConfig(tournamentId.value)
    // 已登录用户预填姓名
    if (authStore.user?.username) {
      form.submitterName = authStore.user.username
    }
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '加载报名信息失败', color: 'error' })
  } finally {
    loading.value = false
  }
})

// ── 添加成员（队伍报名） ──
function addMember() {
  members.value.push({ name: '', preferredPosition: '不限', experience: '' })
}

// ── 移除成员 ──
function removeMember(idx: number) {
  if (members.value.length > 1) {
    members.value.splice(idx, 1)
  }
}

// ── 复选框切换（自定义字段多选，以逗号分隔存储） ──
function toggleCheckbox(fieldKey: string, value: string) {
  const current = (customData[fieldKey] || '').split(',').filter(Boolean)
  const idx = current.indexOf(value)
  if (idx >= 0) {
    current.splice(idx, 1)
  } else {
    current.push(value)
  }
  customData[fieldKey] = current.join(',')
}

// ── 提交报名 ──
async function handleSubmit() {
  // 基本校验
  if (!form.submitterName.trim()) {
    toast.add({ title: '请填写姓名', color: 'warning' })
    return
  }
  if (!form.contactPhone.trim()) {
    toast.add({ title: '请填写联系电话', color: 'warning' })
    return
  }
  if (regType.value === 'team' && !form.teamName.trim()) {
    toast.add({ title: '请填写队伍名称', color: 'warning' })
    return
  }
  // 校验成员姓名
  for (const m of members.value) {
    if (!m.name.trim()) {
      toast.add({ title: '请填写所有成员姓名', color: 'warning' })
      return
    }
  }
  // 校验必填自定义字段
  const fields = config.value?.fields || []
  for (const f of fields) {
    if (f.required && fieldAppliesTo(f) && !customData[f.fieldKey]?.trim()) {
      toast.add({ title: `请填写${f.fieldName}`, color: 'warning' })
      return
    }
  }

  submitting.value = true
  try {
    await submitRegistration(tournamentId.value, {
      type: regType.value,
      teamName: regType.value === 'team' ? form.teamName.trim() : undefined,
      submitterName: form.submitterName.trim(),
      contactPhone: form.contactPhone.trim(),
      contactEmail: form.contactEmail.trim() || undefined,
      notes: form.notes.trim() || undefined,
      customData: Object.keys(customData).length > 0 ? { ...customData } : undefined,
      members: members.value.map(m => ({
        name: m.name.trim(),
        preferredPosition: m.preferredPosition || undefined,
        experience: m.experience.trim() || undefined,
      })),
    })
    submitted.value = true
    toast.add({ title: '报名提交成功', color: 'success' })
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '报名提交失败', color: 'error' })
  } finally {
    submitting.value = false
  }
}

// ── 工具函数：格式化赛制 ──
const formatLabel = (f: string) => f === 'knockout' ? '淘汰赛' : '循环赛'
// ── 工具函数：格式化日期 ──
const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('zh-CN') : '未设置'
</script>

<template>
  <!-- 最外层容器：深色背景由 body 提供 -->
  <div class="min-h-screen">
    <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      <!-- ═══ 配置加载失败 ═══ -->
      <div v-if="!config" class="glass-card p-8 mt-10 text-center">
        <UIcon name="i-lucide-alert-circle" class="w-10 h-10 text-white/40 mx-auto mb-3" />
        <p class="text-white/70 text-sm">报名信息加载失败</p>
      </div>

      <div v-else-if="!config.registrationOpen" class="glass-card p-8 mt-10 text-center">
        <UIcon name="i-lucide-lock" class="w-10 h-10 text-white/40 mx-auto mb-3" />
        <h2 class="text-lg font-semibold text-white mb-2">报名未开放</h2>
        <p class="text-sm text-white/50">该赛事当前未开放报名，请联系赛事组织者。</p>
      </div>

      <!-- ═══ 报名截止提示（已过截止日期但仍开放） ═══ -->
      <div
        v-else-if="config.registrationDeadline && new Date(config.registrationDeadline) < new Date()"
        class="glass-card p-8 mt-10 text-center"
      >
        <UIcon name="i-lucide-calendar-x" class="w-10 h-10 text-white/40 mx-auto mb-3" />
        <h2 class="text-lg font-semibold text-white mb-2">报名已截止</h2>
        <p class="text-sm text-white/50">报名截止时间为 {{ formatDate(config.registrationDeadline) }}，已超出截止时间。</p>
      </div>

      <!-- ═══ 提交成功状态 ═══ -->
      <div v-else-if="submitted" class="glass-card-strong p-10 mt-10 text-center">
        <div class="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
          <UIcon name="i-lucide-check" class="w-9 h-9 text-green-400" />
        </div>
        <h2 class="text-xl font-bold text-white mb-2">报名提交成功</h2>
        <p class="text-sm text-white/60 mb-6">
          您的报名信息已成功提交，请等待赛事组织者审核。
        </p>
        <div class="bg-white/5 rounded-lg p-4 mb-6 text-left max-w-sm mx-auto">
          <div class="flex items-center justify-between text-xs mb-2">
            <span class="text-white/40">报名赛事</span>
            <span class="text-white/90">{{ config.name }}</span>
          </div>
          <div class="flex items-center justify-between text-xs mb-2">
            <span class="text-white/40">报名类型</span>
            <span class="text-white/90">{{ regType === 'team' ? '队伍报名' : '个人报名' }}</span>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-white/40">提交人</span>
            <span class="text-white/90">{{ form.submitterName }}</span>
          </div>
        </div>
        <UButton color="primary" variant="outline" @click="() => { navigateTo('/') }">
          返回首页
        </UButton>
      </div>

      <!-- ═══ 报名表单 ═══ -->
      <template v-else>
        <!-- 头部：赛事信息 -->
        <header class="pt-6 pb-5">
          <p class="dark-page-breadcrumb text-xs mb-1">
            公开报名 / ID: {{ config.id }}
          </p>
          <h1 class="text-white text-[1.75rem] font-bold leading-tight">
            {{ config.name }}
          </h1>
          <!-- 赛事基本信息 -->
          <div class="flex flex-wrap items-center gap-3 mt-3 text-xs text-white/50">
            <span class="flex items-center gap-1">
              <UIcon name="i-lucide-trophy" class="w-3.5 h-3.5" />
              {{ formatLabel(config.format) }}
            </span>
            <span v-if="config.venue" class="flex items-center gap-1">
              <UIcon name="i-lucide-map-pin" class="w-3.5 h-3.5" />
              {{ config.venue }}
            </span>
            <span class="flex items-center gap-1">
              <UIcon name="i-lucide-calendar" class="w-3.5 h-3.5" />
              {{ formatDate(config.scheduledAt) }}
            </span>
            <span v-if="config.teamSize" class="flex items-center gap-1">
              <UIcon name="i-lucide-users" class="w-3.5 h-3.5" />
              队伍规模 {{ config.teamSize }} 人
            </span>
            <UBadge v-if="config.registrationDeadline" color="warning" size="xs" variant="soft">
              截止：{{ formatDate(config.registrationDeadline) }}
            </UBadge>
          </div>
          <!-- 报名须知 -->
          <div v-if="config.registrationInfo" class="mt-4 glass-card p-4">
            <p class="text-xs text-white/40 mb-1 flex items-center gap-1">
              <UIcon name="i-lucide-info" class="w-3.5 h-3.5" />报名须知
            </p>
            <p class="text-sm text-white/80 whitespace-pre-line">{{ config.registrationInfo }}</p>
          </div>
        </header>

        <!-- 表单主体 -->
        <main class="space-y-6 pb-12">

          <!-- ── 报名类型选择 ── -->
          <UCard>
            <template #header>
              <h2 class="text-base font-semibold text-white flex items-center gap-2">
                <UIcon name="i-lucide-clipboard-list" class="w-4 h-4 text-white/40" />
                选择报名类型
              </h2>
            </template>
            <div class="grid grid-cols-2 gap-4">
              <!-- 个人报名 -->
              <div
                class="cursor-pointer rounded-lg border-2 p-4 transition-colors"
                :class="regType === 'individual' ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/10 hover:border-white/20'"
                @click="regType = 'individual'"
              >
                <UIcon name="i-lucide-user" class="w-6 h-6 mb-2" :class="regType === 'individual' ? 'text-indigo-400' : 'text-white/60'" />
                <h3 class="text-sm font-semibold text-white">个人报名</h3>
                <p class="text-xs text-white/40 mt-1">单独报名，可后续调剂到队伍或组队</p>
              </div>
              <!-- 队伍报名 -->
              <div
                class="cursor-pointer rounded-lg border-2 p-4 transition-colors"
                :class="regType === 'team' ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/10 hover:border-white/20'"
                @click="regType = 'team'"
              >
                <UIcon name="i-lucide-users" class="w-6 h-6 mb-2" :class="regType === 'team' ? 'text-indigo-400' : 'text-white/60'" />
                <h3 class="text-sm font-semibold text-white">队伍报名</h3>
                <p class="text-xs text-white/40 mt-1">以队伍形式报名，需填写队伍名称</p>
              </div>
            </div>
          </UCard>

          <!-- ── 队伍名称（仅队伍报名显示） ── -->
          <UCard v-if="regType === 'team'">
            <template #header>
              <h2 class="text-base font-semibold text-white flex items-center gap-2">
                <UIcon name="i-lucide-flag" class="w-4 h-4 text-white/40" />
                队伍信息
              </h2>
            </template>
            <div>
              <label class="block text-xs text-white/40 mb-1">队伍名称 <span class="text-red-500">*</span></label>
              <UInput
                v-model="form.teamName"
                placeholder="请输入队伍名称"
                class="w-full"
                :ui="{ base: 'input-glass' }"
              />
            </div>
          </UCard>

          <!-- ── 联系信息 ── -->
          <UCard>
            <template #header>
              <h2 class="text-base font-semibold text-white flex items-center gap-2">
                <UIcon name="i-lucide-contact" class="w-4 h-4 text-white/40" />
                联系信息
              </h2>
            </template>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs text-white/40 mb-1">姓名 <span class="text-red-500">*</span></label>
                <UInput
                  v-model="form.submitterName"
                  placeholder="请输入您的姓名"
                  class="w-full"
                  :ui="{ base: 'input-glass' }"
                />
              </div>
              <div>
                <label class="block text-xs text-white/40 mb-1">联系电话 <span class="text-red-500">*</span></label>
                <UInput
                  v-model="form.contactPhone"
                  placeholder="请输入手机号或电话"
                  class="w-full"
                  :ui="{ base: 'input-glass' }"
                />
              </div>
              <div class="md:col-span-2">
                <label class="block text-xs text-white/40 mb-1">电子邮箱（选填）</label>
                <UInput
                  v-model="form.contactEmail"
                  type="email"
                  placeholder="请输入邮箱地址"
                  class="w-full"
                  :ui="{ base: 'input-glass' }"
                />
              </div>
            </div>
          </UCard>

          <!-- ── 成员信息 ── -->
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h2 class="text-base font-semibold text-white flex items-center gap-2">
                  <UIcon name="i-lucide-users-round" class="w-4 h-4 text-white/40" />
                  {{ regType === 'team' ? '队伍成员' : '参赛者信息' }}
                  <span v-if="regType === 'team'" class="text-xs font-normal text-white/40">({{ members.length }} 人)</span>
                </h2>
                <button
                  v-if="regType === 'team'"
                  class="flex items-center gap-1 px-3 py-1.5 text-sm border border-indigo-500/30 rounded text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                  @click="addMember"
                >
                  <UIcon name="i-lucide-plus" class="w-3.5 h-3.5" />添加成员
                </button>
              </div>
            </template>

            <div class="space-y-4">
              <div
                v-for="(m, idx) in members"
                :key="idx"
                class="bg-white/5 rounded-lg p-4"
              >
                <!-- 成员头部：序号 + 删除按钮（仅队伍报名且多于 1 人时显示删除） -->
                <div v-if="regType === 'team'" class="flex items-center justify-between mb-3">
                  <span class="text-xs text-white/50 flex items-center gap-1">
                    <UIcon name="i-lucide-user-circle" class="w-3.5 h-3.5" />
                    成员 {{ idx + 1 }}
                  </span>
                  <button
                    v-if="members.length > 1"
                    class="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                    @click="removeMember(idx)"
                  >
                    <UIcon name="i-lucide-trash-2" class="w-3 h-3" />移除
                  </button>
                </div>

                <!-- 成员字段 -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label class="block text-xs text-white/40 mb-1">姓名 <span class="text-red-500">*</span></label>
                    <UInput
                      v-model="m.name"
                      placeholder="成员姓名"
                      class="w-full"
                      :ui="{ base: 'input-glass' }"
                    />
                  </div>
                  <div>
                    <label class="block text-xs text-white/40 mb-1">意向职位</label>
                    <USelect
                      v-model="m.preferredPosition"
                      :items="positionOptions"
                      class="w-full"
                      :ui="{ base: 'input-glass' }"
                    />
                  </div>
                  <div>
                    <label class="block text-xs text-white/40 mb-1">辩论经历（选填）</label>
                    <UInput
                      v-model="m.experience"
                      placeholder="如：3 年"
                      class="w-full"
                      :ui="{ base: 'input-glass' }"
                    />
                  </div>
                </div>
              </div>
            </div>
          </UCard>

          <!-- ── 自定义字段（如存在） ── -->
          <UCard v-if="visibleFields.length > 0">
            <template #header>
              <h2 class="text-base font-semibold text-white flex items-center gap-2">
                <UIcon name="i-lucide-form-input" class="w-4 h-4 text-white/40" />
                补充信息
              </h2>
            </template>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                v-for="field in visibleFields"
                :key="field.id"
                :class="field.fieldType === 'textarea' ? 'md:col-span-2' : ''"
              >
                <label class="block text-xs text-white/40 mb-1">
                  {{ field.fieldName }}
                  <span v-if="field.required" class="text-red-500">*</span>
                </label>

                <!-- 文本输入 -->
                <UInput
                  v-if="field.fieldType === 'text'"
                  v-model="customData[field.fieldKey]"
                  :placeholder="`请输入${field.fieldName}`"
                  class="w-full"
                  :ui="{ base: 'input-glass' }"
                />

                <!-- 多行文本 -->
                <UTextarea
                  v-else-if="field.fieldType === 'textarea'"
                  v-model="customData[field.fieldKey]"
                  :rows="3"
                  :placeholder="`请输入${field.fieldName}`"
                  class="w-full"
                  :ui="{ base: 'input-glass' }"
                />

                <!-- 下拉选择 / 单选 -->
                <USelect
                  v-else-if="field.fieldType === 'select' || field.fieldType === 'radio'"
                  v-model="customData[field.fieldKey]"
                  :items="parseFieldOptions(field.fieldOptions)"
                  :placeholder="`请选择${field.fieldName}`"
                  class="w-full"
                  :ui="{ base: 'input-glass' }"
                />

                <!-- 多选（复选框组） -->
                <div v-else-if="field.fieldType === 'checkbox'" class="flex flex-wrap gap-3 mt-1">
                  <label
                    v-for="opt in parseFieldOptions(field.fieldOptions)"
                    :key="opt.value"
                    class="flex items-center gap-2 text-sm text-white/80 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      :value="opt.value"
                      class="rounded border-white/20 bg-white/5 text-indigo-500 focus:ring-indigo-500/30"
                      :checked="(customData[field.fieldKey] || '').split(',').includes(opt.value)"
                      @change="toggleCheckbox(field.fieldKey, opt.value)"
                    />
                    {{ opt.label }}
                  </label>
                </div>

                <!-- 未知类型降级为文本输入 -->
                <UInput
                  v-else
                  v-model="customData[field.fieldKey]"
                  :placeholder="`请输入${field.fieldName}`"
                  class="w-full"
                  :ui="{ base: 'input-glass' }"
                />
              </div>
            </div>
          </UCard>

          <!-- ── 备注 ── -->
          <UCard>
            <template #header>
              <h2 class="text-base font-semibold text-white flex items-center gap-2">
                <UIcon name="i-lucide-message-square" class="w-4 h-4 text-white/40" />
                备注（选填）
              </h2>
            </template>
            <UTextarea
              v-model="form.notes"
              :rows="3"
              placeholder="如有特殊需求或说明，请在此填写"
              class="w-full"
              :ui="{ base: 'input-glass' }"
            />
          </UCard>

          <!-- ── 提交按钮 ── -->
          <div class="flex items-center justify-end gap-3 pt-2">
            <UButton
              color="neutral"
              variant="outline"
              @click="() => { navigateTo('/') }"
            >
              取消
            </UButton>
            <UButton
              color="primary"
              size="lg"
              :loading="submitting"
              class="btn-primary"
              @click="handleSubmit"
            >
              <UIcon name="i-lucide-send" class="w-4 h-4 mr-1" />
              {{ submitting ? '提交中...' : '提交报名' }}
            </UButton>
          </div>
        </main>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* 深色玻璃拟态样式由全局 main.css 提供，此处无需额外 scoped 样式 */
</style>
