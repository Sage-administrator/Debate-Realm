<script setup lang="ts">
// 赛事公开报名页（无需登录即可访问）
// 动态渲染所有字段（系统字段 + 自定义字段），不再硬编码默认字段
const route = useRoute()
const toast = useToast()
const authStore = useAuthStore()
const { getRegistrationConfig, submitRegistration } = useRegistration()

const tournamentId = computed(() => route.params.id as string)
const loading = ref(true)
const config = ref<any>(null)
const loadError = ref(false)
const submitting = ref(false)
const submitted = ref(false)

// ── 表单状态 ──
const regType = ref<'individual' | 'team'>('individual')
// 统一表单数据：系统字段 + 自定义字段都存在这里
const formData = reactive<Record<string, any>>({})
// 成员列表（members 类型字段专用）
const members = ref<{ name: string; preferredPosition: string; experience: string }[]>([
  { name: '', preferredPosition: '不限', experience: '' },
])

// ── 辩论赛职位选项 ──
const positionOptions = [
  { label: '不限', value: '不限' },
  { label: '一辩', value: '一辩' },
  { label: '二辩', value: '二辩' },
  { label: '三辩', value: '三辩' },
  { label: '四辩', value: '四辩' },
]

// ── 解析字段选项（兼容 JSON 数组和逗号分隔字符串） ──
function parseFieldOptions(raw: string | null | undefined): { label: string; value: string }[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.map((item: any) =>
        typeof item === 'string'
          ? { label: item, value: item }
          : { label: item.label, value: item.value },
      )
    }
    return []
  } catch {
    // 非 JSON 时按逗号分隔处理
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => ({ label: s, value: s }))
  }
}

// ── 字段是否适用于当前报名类型 ──
function fieldAppliesTo(field: any): boolean {
  if (!field.appliesTo || field.appliesTo === 'both' || field.appliesTo === 'all') return true
  return field.appliesTo === regType.value
}

// 过滤后的可见字段（按 sortOrder 排序）
const visibleFields = computed(() => {
  const fields = config.value?.fields || []
  return fields.filter((f: any) => fieldAppliesTo(f))
})

// ── 赛事允许的报名类型 ──
const allowedRegType = computed(() => config.value?.registrationType || 'both')
const canIndividual = computed(
  () => allowedRegType.value === 'individual' || allowedRegType.value === 'both',
)
const canTeam = computed(() => allowedRegType.value === 'team' || allowedRegType.value === 'both')

// ── 加载报名配置 ──
onMounted(async () => {
  try {
    config.value = await getRegistrationConfig(tournamentId.value)
    // 根据赛事报名类型配置，设置默认报名类型
    const allowedType = config.value?.registrationType || 'both'
    if (allowedType === 'individual') {
      regType.value = 'individual'
    } else if (allowedType === 'team') {
      regType.value = 'team'
    }
    // 已登录用户预填姓名
    if (authStore.user?.username) {
      formData.submitterName = authStore.user.username
    }
  } catch (e: any) {
    loadError.value = true
    toast.add({
      title: e?.data?.message || e?.data?.statusMessage || '加载报名信息失败',
      color: 'error',
    })
  } finally {
    loading.value = false
  }
})

// ── 添加/移除成员（members 类型字段） ──
function addMember() {
  members.value.push({ name: '', preferredPosition: '不限', experience: '' })
}
function removeMember(idx: number) {
  if (members.value.length > 1) {
    members.value.splice(idx, 1)
  }
}

// ── 复选框切换（多选字段，以逗号分隔存储） ──
function toggleCheckbox(fieldKey: string, value: string) {
  const current = (formData[fieldKey] || '').split(',').filter(Boolean)
  const idx = current.indexOf(value)
  if (idx >= 0) {
    current.splice(idx, 1)
  } else {
    current.push(value)
  }
  formData[fieldKey] = current.join(',')
}

// ── 提交报名 ──
async function handleSubmit() {
  // 校验必填字段
  const fields = config.value?.fields || []
  for (const f of fields) {
    // 跳过装饰元素和不适用的字段
    if (['divider', 'heading'].includes(f.fieldType)) continue
    if (!fieldAppliesTo(f)) continue
    // members 类型单独校验
    if (f.fieldType === 'members') {
      if (f.required) {
        for (const m of members.value) {
          if (!m.name.trim()) {
            toast.add({ title: `请填写所有${f.fieldName}的姓名`, color: 'warning' })
            return
          }
        }
      }
      continue
    }
    // 其他字段校验
    if (f.required && !String(formData[f.fieldKey] || '').trim()) {
      toast.add({ title: `请填写${f.fieldName}`, color: 'warning' })
      return
    }
  }

  submitting.value = true
  try {
    // 准备提交数据：系统字段映射到独立列，其他字段存到 customData
    const submitData: any = {
      type: regType.value,
      submitterName: String(formData.submitterName || '').trim(),
      contactPhone: String(formData.contactPhone || '').trim(),
      contactEmail: formData.contactEmail ? String(formData.contactEmail).trim() : undefined,
      teamName: regType.value === 'team' ? String(formData.teamName || '').trim() : undefined,
      notes: formData.notes ? String(formData.notes).trim() : undefined,
      members: members.value.map((m) => ({
        name: m.name.trim(),
        preferredPosition: m.preferredPosition || undefined,
        experience: m.experience.trim() || undefined,
      })),
    }

    // 收集自定义字段数据（排除系统字段）
    const systemKeys = [
      'submitterName',
      'contactPhone',
      'contactEmail',
      'teamName',
      'notes',
      'members',
    ]
    const customData: Record<string, string> = {}
    for (const f of fields) {
      if (['divider', 'heading', 'members'].includes(f.fieldType)) continue
      if (systemKeys.includes(f.fieldKey)) continue
      if (fieldAppliesTo(f) && formData[f.fieldKey] !== undefined) {
        customData[f.fieldKey] = String(formData[f.fieldKey] || '').trim()
      }
    }
    if (Object.keys(customData).length > 0) {
      submitData.customData = customData
    }

    await submitRegistration(tournamentId.value, submitData)
    submitted.value = true
    toast.add({ title: '报名提交成功', color: 'success' })
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '报名提交失败', color: 'error' })
  } finally {
    submitting.value = false
  }
}

// ── 工具函数 ──
const formatLabel = (f: string) => (f === 'knockout' ? '淘汰赛' : '循环赛')
const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('zh-CN') : '未设置')
</script>

<template>
  <!-- 最外层容器：深色背景由 body 提供 -->
  <div class="min-h-screen">
    <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- ═══ 加载中 ═══ -->
      <div v-if="loading" class="glass-card p-8 mt-10 text-center">
        <div
          class="w-8 h-8 border-2 border-[var(--color-border)] border-t-indigo-400 rounded-full animate-spin mx-auto mb-3"
        ></div>
        <p class="text-[var(--color-text-secondary)] text-sm">加载中...</p>
      </div>

      <!-- ═══ 配置加载失败 ═══ -->
      <div v-else-if="loadError || !config" class="glass-card p-8 mt-10 text-center">
        <UIcon
          name="i-lucide-alert-circle"
          class="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-3"
        />
        <p class="text-[var(--color-text-secondary)] text-sm">报名信息加载失败</p>
      </div>

      <div v-else-if="!config.registrationOpen" class="glass-card p-8 mt-10 text-center">
        <UIcon name="i-lucide-lock" class="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-3" />
        <h2 class="text-lg font-semibold text-[var(--color-text-primary)] mb-2">报名未开放</h2>
        <p class="text-sm text-[var(--color-text-muted)]">
          该赛事当前未开放报名，请联系赛事组织者。
        </p>
      </div>

      <!-- ═══ 报名截止提示 ═══ -->
      <div
        v-else-if="
          config.registrationDeadline && new Date(config.registrationDeadline) < new Date()
        "
        class="glass-card p-8 mt-10 text-center"
      >
        <UIcon
          name="i-lucide-calendar-x"
          class="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-3"
        />
        <h2 class="text-lg font-semibold text-[var(--color-text-primary)] mb-2">报名已截止</h2>
        <p class="text-sm text-[var(--color-text-muted)]">
          报名截止时间为 {{ formatDate(config.registrationDeadline) }}，已超出截止时间。
        </p>
      </div>

      <!-- ═══ 提交成功状态 ═══ -->
      <div v-else-if="submitted" class="glass-card-strong p-10 mt-10 text-center">
        <div
          class="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4"
        >
          <UIcon name="i-lucide-check" class="w-9 h-9 text-green-600 dark:text-green-400" />
        </div>
        <h2 class="text-xl font-bold text-[var(--color-text-primary)] mb-2">报名提交成功</h2>
        <p class="text-sm text-[var(--color-text-secondary)] mb-6">
          您的报名信息已成功提交，请等待赛事组织者审核。
        </p>
        <div class="bg-[var(--color-bg-secondary)] rounded-lg p-4 mb-6 text-left max-w-sm mx-auto">
          <div class="flex items-center justify-between text-xs mb-2">
            <span class="text-[var(--color-text-muted)]">报名赛事</span>
            <span class="text-[var(--color-text-primary)]">{{ config.name }}</span>
          </div>
          <div class="flex items-center justify-between text-xs mb-2">
            <span class="text-[var(--color-text-muted)]">报名类型</span>
            <span class="text-[var(--color-text-primary)]">{{
              regType === 'team' ? '队伍报名' : '个人报名'
            }}</span>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-[var(--color-text-muted)]">提交人</span>
            <span class="text-[var(--color-text-primary)]">{{ formData.submitterName }}</span>
          </div>
        </div>
        <UButton
          color="primary"
          variant="outline"
          @click="
            () => {
              navigateTo('/')
            }
          "
        >
          返回首页
        </UButton>
      </div>

      <!-- ═══ 报名表单（动态渲染） ═══ -->
      <template v-else>
        <!-- 头部：赛事信息 -->
        <header class="pt-6 pb-5">
          <p class="dark-page-breadcrumb text-xs mb-1">公开报名 / ID: {{ config.id }}</p>
          <h1 class="text-white text-[1.75rem] font-bold leading-tight">
            {{ config.name }}
          </h1>
          <div
            class="flex flex-wrap items-center gap-3 mt-3 text-xs text-[var(--color-text-muted)]"
          >
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
            <p class="text-xs text-[var(--color-text-muted)] mb-1 flex items-center gap-1">
              <UIcon name="i-lucide-info" class="w-3.5 h-3.5" />报名须知
            </p>
            <p class="text-sm text-[var(--color-text-primary)] whitespace-pre-line">
              {{ config.registrationInfo }}
            </p>
          </div>
        </header>

        <!-- 表单主体：动态渲染所有字段 -->
        <div class="space-y-6 pb-12">
          <!-- ── 报名类型选择（仅当允许个人+队伍时显示） ── -->
          <UCard v-if="canIndividual && canTeam">
            <template #header>
              <h2
                class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2"
              >
                <UIcon
                  name="i-lucide-clipboard-list"
                  class="w-4 h-4 text-[var(--color-text-muted)]"
                />
                选择报名类型
              </h2>
            </template>
            <div class="grid grid-cols-2 gap-4">
              <div
                class="cursor-pointer rounded-lg border-2 p-4 transition-colors"
                :class="
                  regType === 'individual'
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-[var(--color-border)] hover:border-[var(--color-border)]'
                "
                @click="
                  () => {
                    regType = 'individual'
                  }
                "
              >
                <UIcon
                  name="i-lucide-user"
                  class="w-6 h-6 mb-2"
                  :class="
                    regType === 'individual'
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-[var(--color-text-secondary)]'
                  "
                />
                <h3 class="text-sm font-semibold text-[var(--color-text-primary)]">个人报名</h3>
                <p class="text-xs text-[var(--color-text-muted)] mt-1">
                  单独报名，可后续调剂到队伍或组队
                </p>
              </div>
              <div
                class="cursor-pointer rounded-lg border-2 p-4 transition-colors"
                :class="
                  regType === 'team'
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-[var(--color-border)] hover:border-[var(--color-border)]'
                "
                @click="
                  () => {
                    regType = 'team'
                  }
                "
              >
                <UIcon
                  name="i-lucide-users"
                  class="w-6 h-6 mb-2"
                  :class="
                    regType === 'team'
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-[var(--color-text-secondary)]'
                  "
                />
                <h3 class="text-sm font-semibold text-[var(--color-text-primary)]">队伍报名</h3>
                <p class="text-xs text-[var(--color-text-muted)] mt-1">
                  以队伍形式报名，需填写队伍名称
                </p>
              </div>
            </div>
          </UCard>

          <!-- ── 动态字段渲染 ── -->
          <template v-for="(field, idx) in visibleFields" :key="field.id || idx">
            <!-- 装饰元素：分割线 -->
            <div
              v-if="field.fieldType === 'divider'"
              class="border-t border-[var(--color-border)] my-2"
            ></div>

            <!-- 装饰元素：分组标题 -->
            <h3
              v-else-if="field.fieldType === 'heading'"
              class="text-base font-bold text-[var(--color-text-primary)] mt-4 mb-1"
            >
              {{ field.fieldName }}
            </h3>

            <!-- members 类型字段：成员信息（支持动态增减） -->
            <UCard v-else-if="field.fieldType === 'members'">
              <template #header>
                <div class="flex items-center justify-between">
                  <h2
                    class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2"
                  >
                    <UIcon
                      name="i-lucide-users-round"
                      class="w-4 h-4 text-[var(--color-text-muted)]"
                    />
                    {{ regType === 'team' ? '队伍成员' : field.fieldName || '参赛者信息' }}
                    <span
                      v-if="regType === 'team'"
                      class="text-xs font-normal text-[var(--color-text-muted)]"
                      >({{ members.length }} 人)</span
                    >
                    <span v-if="field.required" class="text-red-500 text-sm">*</span>
                  </h2>
                  <button
                    v-if="regType === 'team'"
                    class="flex items-center gap-1 px-3 py-1.5 text-sm border border-indigo-500/30 rounded text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                    @click="addMember"
                  >
                    <UIcon name="i-lucide-plus" class="w-3.5 h-3.5" />添加成员
                  </button>
                </div>
              </template>

              <div class="space-y-4">
                <div
                  v-for="(m, mIdx) in members"
                  :key="mIdx"
                  class="bg-[var(--color-bg-secondary)] rounded-lg p-4"
                >
                  <div v-if="regType === 'team'" class="flex items-center justify-between mb-3">
                    <span class="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                      <UIcon name="i-lucide-user-circle" class="w-3.5 h-3.5" />
                      成员 {{ mIdx + 1 }}
                    </span>
                    <button
                      v-if="members.length > 1"
                      class="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-1"
                      @click="removeMember(mIdx)"
                    >
                      <UIcon name="i-lucide-trash-2" class="w-3 h-3" />移除
                    </button>
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label class="block text-xs text-[var(--color-text-muted)] mb-1">
                        姓名
                        <span v-if="field.required" class="text-red-500">*</span>
                      </label>
                      <UInput
                        v-model="m.name"
                        placeholder="成员姓名"
                        class="w-full"
                        :ui="{ base: 'input-glass' }"
                      />
                    </div>
                    <div>
                      <label class="block text-xs text-[var(--color-text-muted)] mb-1"
                        >意向职位</label
                      >
                      <!-- USelect 为客户端组件，SSR 渲染会与水合结果不一致 -->
                      <ClientOnly>
                        <USelect
                          v-model="m.preferredPosition"
                          :items="positionOptions"
                          class="w-full"
                          :ui="{ base: 'input-glass' }"
                        />
                        <template #fallback>
                          <div
                            class="w-full h-8 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
                          ></div>
                        </template>
                      </ClientOnly>
                    </div>
                    <div>
                      <label class="block text-xs text-[var(--color-text-muted)] mb-1"
                        >辩论经历（选填）</label
                      >
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

            <!-- 普通字段：统一渲染 -->
            <UCard v-else>
              <template #header>
                <h2
                  class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2"
                >
                  <UIcon
                    :name="
                      (
                        {
                          text: 'i-lucide-type',
                          textarea: 'i-lucide-align-left',
                          select: 'i-lucide-chevron-down-square',
                          radio: 'i-lucide-circle-dot',
                          checkbox: 'i-lucide-check-square',
                          number: 'i-lucide-hash',
                          date: 'i-lucide-calendar',
                          phone: 'i-lucide-phone',
                          email: 'i-lucide-mail',
                        } as Record<string, string>
                      )[field.fieldType] || 'i-lucide-square'
                    "
                    class="w-4 h-4 text-[var(--color-text-muted)]"
                  />
                  {{ field.fieldName }}
                  <span v-if="field.required" class="text-red-500 text-sm">*</span>
                  <span
                    v-else-if="!['heading', 'divider'].includes(field.fieldType)"
                    class="text-xs font-normal text-[var(--color-text-muted)]"
                    >（选填）</span
                  >
                </h2>
              </template>

              <!-- 字段描述 -->
              <p v-if="field.description" class="text-xs text-[var(--color-text-muted)] mb-2">
                {{ field.description }}
              </p>

              <!-- 根据字段类型渲染不同输入控件 -->
              <div :class="field.width === 'half' ? 'md:max-w-xs' : ''">
                <!-- 单行文本 -->
                <UInput
                  v-if="field.fieldType === 'text'"
                  v-model="formData[field.fieldKey]"
                  :placeholder="field.placeholder || `请输入${field.fieldName}`"
                  class="w-full"
                  :ui="{ base: 'input-glass' }"
                />

                <!-- 多行文本 -->
                <UTextarea
                  v-else-if="field.fieldType === 'textarea'"
                  v-model="formData[field.fieldKey]"
                  :rows="3"
                  :placeholder="field.placeholder || `请输入${field.fieldName}`"
                  class="w-full"
                  :ui="{ base: 'input-glass' }"
                />

                <!-- 数字 -->
                <UInput
                  v-else-if="field.fieldType === 'number'"
                  v-model="formData[field.fieldKey]"
                  type="number"
                  :placeholder="field.placeholder || `请输入${field.fieldName}`"
                  class="w-full"
                  :ui="{ base: 'input-glass' }"
                />

                <!-- 日期 -->
                <BaseDateTimePicker
                  v-else-if="field.fieldType === 'date'"
                  v-model="formData[field.fieldKey]"
                  mode="date"
                  placeholder="选择日期"
                />

                <!-- 电话 -->
                <UInput
                  v-else-if="field.fieldType === 'phone'"
                  v-model="formData[field.fieldKey]"
                  type="tel"
                  :placeholder="field.placeholder || '请输入手机号或电话'"
                  class="w-full"
                  :ui="{ base: 'input-glass' }"
                />

                <!-- 邮箱 -->
                <UInput
                  v-else-if="field.fieldType === 'email'"
                  v-model="formData[field.fieldKey]"
                  type="email"
                  :placeholder="field.placeholder || '请输入邮箱地址'"
                  class="w-full"
                  :ui="{ base: 'input-glass' }"
                />

                <!-- 下拉选择 / 单选 -->
                <!-- USelect 为客户端组件，且 items 依赖 parseFieldOptions 解析（运行时才有数据），用 ClientOnly 包裹 -->
                <ClientOnly v-else-if="field.fieldType === 'select' || field.fieldType === 'radio'">
                  <USelect
                    v-model="formData[field.fieldKey]"
                    :items="parseFieldOptions(field.fieldOptions)"
                    :placeholder="`请选择${field.fieldName}`"
                    class="w-full"
                    :ui="{ base: 'input-glass' }"
                  />
                  <template #fallback>
                    <div
                      class="w-full h-8 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
                    ></div>
                  </template>
                </ClientOnly>

                <!-- 多选（复选框组） -->
                <div v-else-if="field.fieldType === 'checkbox'" class="flex flex-wrap gap-3">
                  <label
                    v-for="opt in parseFieldOptions(field.fieldOptions)"
                    :key="opt.value"
                    class="flex items-center gap-2 text-sm text-[var(--color-text-primary)] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      :value="opt.value"
                      class="rounded border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-indigo-500 focus:ring-indigo-500/30"
                      :checked="(formData[field.fieldKey] || '').split(',').includes(opt.value)"
                      @change="toggleCheckbox(field.fieldKey, opt.value)"
                    />
                    {{ opt.label }}
                  </label>
                </div>

                <!-- 未知类型降级为文本输入 -->
                <UInput
                  v-else
                  v-model="formData[field.fieldKey]"
                  :placeholder="field.placeholder || `请输入${field.fieldName}`"
                  class="w-full"
                  :ui="{ base: 'input-glass' }"
                />
              </div>
            </UCard>
          </template>

          <!-- ── 提交按钮 ── -->
          <div class="flex items-center justify-end gap-3 pt-2">
            <UButton
              color="neutral"
              variant="outline"
              @click="
                () => {
                  navigateTo('/')
                }
              "
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
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* 深色玻璃拟态样式由全局 main.css 提供，此处无需额外 scoped 样式 */
</style>
