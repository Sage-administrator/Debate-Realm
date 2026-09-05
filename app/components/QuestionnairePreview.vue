<script setup lang="ts">
/**
 * QuestionnairePreview.vue — 问卷「试答」预览（受访者视角，纯前端、不落库）
 *
 * 用途：FormDesigner 设计器内的「试答」按钮打开本组件，按当前设计稿渲染出
 * 受访者看到的真实表单，支持全部题型交互与必填/量程校验。提交后仅本地提示
 * 成功并打印收集结果，不会写入数据库（试答数据不计入正式统计）。
 *
 * 与 QuestionnaireFill.vue 的区别：
 * - 不调用后端 submit 接口、不依赖已保存的 questionnaire / matchId
 * - 不做受众登录拦截（试答无需登录）
 * - 题目直接由 FormDesigner 的 fields 映射而来
 */
import { sanitizeHtml } from '~/utils/richtext'

const props = defineProps<{
  fields: any[]
  title?: string
  description?: string
  /** 整卷设置（FormDesigner.formSettings）：含 align / submitText / thankYouText / showNumber / title / description */
  settings?: any
}>()

const toast = useToast()

// ── 整卷设置（优先取 settings，兼容旧 title/description 入参）──
const qTitle = computed(() => props.settings?.title ?? props.title ?? '问卷标题')
const qDesc = computed(() => props.settings?.description ?? props.description ?? '')
const qAlign = computed<'left' | 'center' | 'right'>(props.settings?.align ?? 'center')
const qSubmitText = computed(() => props.settings?.submitText || '提交')
const qThankYou = computed(() => props.settings?.thankYouText || '')
const qShowNumber = computed(() => props.settings?.showNumber !== false)
const qDescHtml = computed(() => sanitizeHtml(qDesc.value))
const qAlignClass = computed(
  () =>
    ({
      left: 'text-left',
      center: 'text-center',
      right: 'text-right',
    })[qAlign.value],
)

const submitting = ref(false)
const finished = ref(false)
const formData = reactive<Record<string, any>>({})

// 将设计器字段映射为受访者题目（兼容 QuestionnaireFill 的字段名）
const questions = computed(() =>
  (props.fields || [])
    .filter((f) => f && f.fieldType)
    .map((f, i) => ({
      id: f.id || `f-${i}`,
      fieldKey: f.fieldKey || `field_${i}`,
      title: f.fieldName || '未命名题目',
      questionType: f.fieldType,
      options: f.fieldOptions, // JSON 字符串或 null
      required: !!f.required,
      description: sanitizeHtml(f.description || ''),
      meta: f.meta && typeof f.meta === 'object' ? f.meta : null,
    })),
)

const visibleQuestions = computed(() =>
  questions.value.filter((q) => !['divider', 'heading'].includes(q.questionType)),
)
const isEmpty = computed(() => visibleQuestions.value.length === 0)

// 为普通题目顺次编号（分割线/分组标题不计入）
const numberedQuestions = computed(() => {
  let n = 0
  return questions.value.map((q) => {
    if (['divider', 'heading'].includes(q.questionType)) return { ...q, no: 0 }
    n += 1
    return { ...q, no: n }
  })
})

// ── 选项解析 ──
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
  } catch {
    return String(raw)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => ({ label: s, value: s }))
  }
  return []
}

// ── 量表 meta ──
function scaleMeta(q: any) {
  const m = q.meta && typeof q.meta === 'object' ? q.meta : {}
  return {
    min: typeof m.min === 'number' ? m.min : 1,
    max: typeof m.max === 'number' ? m.max : 5,
    step: typeof m.step === 'number' ? m.step : 1,
    leftLabel: m.leftLabel || '差',
    rightLabel: m.rightLabel || '好',
  }
}

function scaleValues(q: any): number[] {
  const { min, max, step } = scaleMeta(q)
  const vals: number[] = []
  for (let v = min; v <= max + 1e-9; v = Math.round((v + step) * 1e6) / 1e6) {
    vals.push(v)
  }
  return vals
}

function selectScale(q: any, value: number) {
  formData[q.fieldKey] = value
}

// ── 复选框切换 ──
function toggleCheckbox(fieldKey: string, value: string) {
  const current = (formData[fieldKey] || '').split(',').filter(Boolean)
  const idx = current.indexOf(value)
  if (idx >= 0) current.splice(idx, 1)
  else current.push(value)
  formData[fieldKey] = current.join(',')
}

// ── 提交（仅本地模拟，不落库）──
function handleSubmit() {
  // 必填与量程校验
  for (const q of visibleQuestions.value) {
    if (q.questionType === 'members') continue
    const raw = formData[q.fieldKey]
    const val = raw === undefined || raw === null ? '' : String(raw)
    if (q.required && !val.trim()) {
      toast.add({ title: `请填写：${q.title}`, color: 'warning' })
      return
    }
    if (q.questionType === 'scale' && val.trim()) {
      const { min, max } = scaleMeta(q)
      const num = Number(val)
      if (!Number.isFinite(num) || num < min || num > max) {
        toast.add({ title: `${q.title} 的分值需在 ${min}-${max} 之间`, color: 'warning' })
        return
      }
    }
  }

  submitting.value = true
  // 模拟网络延迟，给提交按钮 loading 态
  setTimeout(() => {
    submitting.value = false
    finished.value = true
    // 打印收集结果，便于核对数据格式
    console.log('[试答] 收集到的回答：', JSON.parse(JSON.stringify(formData)))
  }, 350)
}

// ── 重置 ──
function resetForm() {
  for (const k of Object.keys(formData)) delete formData[k]
  finished.value = false
}
</script>

<template>
  <div class="qprev">
    <!-- 试答成功态 -->
    <div v-if="finished" class="qprev-done">
      <div
        class="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3"
      >
        <UIcon name="i-lucide-check" class="w-8 h-8 text-green-600 dark:text-green-400" />
      </div>
      <h3 class="text-base font-semibold text-[var(--color-text-primary)] mb-1 text-center">
        试答完成
      </h3>
      <p v-if="qThankYou" class="text-sm text-[var(--color-text-secondary)] text-center mb-2">
        {{ qThankYou }}
      </p>
      <p class="text-sm text-[var(--color-text-muted)] text-center mb-5">
        这是一次模拟提交，测试数据<strong class="text-[var(--color-text-secondary)]"
          >不会保存</strong
        >，也不计入正式统计。
      </p>
      <div class="flex items-center justify-center gap-3">
        <UButton color="neutral" variant="outline" @click="resetForm">再试一次</UButton>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else-if="isEmpty" class="py-12 text-center">
      <UIcon
        name="i-lucide-inbox"
        class="w-10 h-10 text-[var(--color-border-muted)] mx-auto mb-3"
      />
      <p class="text-sm text-[var(--color-text-muted)]">
        当前问卷还没有可作答的题目，请先在设计器中添加题型。
      </p>
    </div>

    <!-- 作答态 -->
    <template v-else>
      <!-- 问卷标题与说明 -->
      <div class="mb-5" :class="qAlignClass">
        <h2 class="text-xl font-bold text-[var(--color-text-primary)]">{{ qTitle }}</h2>
        <!-- 富文本说明（已净化） -->
        <div
          v-if="qDescHtml"
          class="qprev-rich mt-2 text-sm text-[var(--color-text-secondary)] leading-relaxed inline-block text-left"
          :class="qAlign === 'center' ? 'mx-auto' : qAlign === 'right' ? 'ml-auto' : ''"
          v-html="qDescHtml"
        />
      </div>

      <div class="space-y-5">
        <template v-for="(q, idx) in numberedQuestions" :key="q.id || idx">
          <!-- 分割线 -->
          <div
            v-if="q.questionType === 'divider'"
            class="border-t border-[var(--color-border)] my-2"
          />
          <!-- 分组标题 -->
          <h3
            v-else-if="q.questionType === 'heading'"
            class="text-base font-bold text-[var(--color-text-primary)] mt-2"
          >
            {{ q.title }}
          </h3>

          <!-- 量表题 -->
          <UCard v-else-if="q.questionType === 'scale'">
            <template #header>
              <h2
                class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2"
              >
                <UIcon name="i-lucide-star" class="w-4 h-4 text-[var(--color-accent-primary)]" />
                <span v-if="qShowNumber && q.no" class="text-[var(--color-text-muted)] font-normal"
                  >{{ q.no }}.</span
                >
                {{ q.title }}
                <span v-if="q.required" class="text-red-500 text-sm">*</span>
                <span v-else class="text-xs font-normal text-[var(--color-text-muted)]"
                  >（选填）</span
                >
              </h2>
            </template>
            <p
              v-if="q.description"
              class="text-xs text-[var(--color-text-muted)] mb-3"
              v-html="q.description"
            />
            <div
              class="flex items-center justify-between mb-2 text-xs text-[var(--color-text-muted)]"
            >
              <span>{{ scaleMeta(q).leftLabel }}</span>
              <span>{{ scaleMeta(q).rightLabel }}</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="v in scaleValues(q)"
                :key="v"
                type="button"
                :class="[
                  'w-11 h-11 rounded-lg border text-sm font-semibold transition-colors',
                  formData[q.fieldKey] === v
                    ? 'border-indigo-500 bg-indigo-500 text-white'
                    : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:border-indigo-400',
                ]"
                @click="selectScale(q, v)"
              >
                {{ v }}
              </button>
            </div>
          </UCard>

          <!-- 普通字段 -->
          <UCard v-else>
            <template #header>
              <h2
                class="text-base font-semibold text-[var(--color-text-primary)] flex items-center gap-2"
              >
                <UIcon name="i-lucide-square" class="w-4 h-4 text-[var(--color-text-muted)]" />
                <span v-if="qShowNumber && q.no" class="text-[var(--color-text-muted)] font-normal"
                  >{{ q.no }}.</span
                >
                {{ q.title }}
                <span v-if="q.required" class="text-red-500 text-sm">*</span>
                <span v-else class="text-xs font-normal text-[var(--color-text-muted)]"
                  >（选填）</span
                >
              </h2>
            </template>
            <p
              v-if="q.description"
              class="text-xs text-[var(--color-text-muted)] mb-2"
              v-html="q.description"
            />

            <!-- 单行文本 -->
            <UInput
              v-if="q.questionType === 'text'"
              v-model="formData[q.fieldKey]"
              class="w-full"
              :ui="{ base: 'input-glass' }"
              :placeholder="`请输入${q.title}`"
            />
            <!-- 多行文本 -->
            <UTextarea
              v-else-if="q.questionType === 'textarea'"
              v-model="formData[q.fieldKey]"
              :rows="3"
              class="w-full"
              :ui="{ base: 'input-glass' }"
              :placeholder="`请输入${q.title}`"
            />
            <!-- 数字 -->
            <UInput
              v-else-if="q.questionType === 'number'"
              v-model="formData[q.fieldKey]"
              type="number"
              class="w-full"
              :ui="{ base: 'input-glass' }"
              :placeholder="`请输入${q.title}`"
            />
            <!-- 日期 -->
            <BaseDateTimePicker
              v-else-if="q.questionType === 'date'"
              v-model="formData[q.fieldKey]"
              mode="date"
              placeholder="选择日期"
            />
            <!-- 电话 -->
            <UInput
              v-else-if="q.questionType === 'phone'"
              v-model="formData[q.fieldKey]"
              type="tel"
              class="w-full"
              :ui="{ base: 'input-glass' }"
              placeholder="请输入手机号或电话"
            />
            <!-- 邮箱 -->
            <UInput
              v-else-if="q.questionType === 'email'"
              v-model="formData[q.fieldKey]"
              type="email"
              class="w-full"
              :ui="{ base: 'input-glass' }"
              placeholder="请输入邮箱地址"
            />
            <!-- 下拉 / 单选 -->
            <ClientOnly v-else-if="q.questionType === 'select' || q.questionType === 'radio'">
              <USelect
                v-model="formData[q.fieldKey]"
                :items="parseFieldOptions(q.options)"
                class="w-full"
                :ui="{ base: 'input-glass' }"
                :placeholder="`请选择${q.title}`"
              />
              <template #fallback>
                <div
                  class="w-full h-8 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
                />
              </template>
            </ClientOnly>
            <!-- 多选 -->
            <div v-else-if="q.questionType === 'checkbox'" class="flex flex-wrap gap-3">
              <label
                v-for="opt in parseFieldOptions(q.options)"
                :key="opt.value"
                class="flex items-center gap-2 text-sm text-[var(--color-text-primary)] cursor-pointer"
              >
                <input
                  type="checkbox"
                  :value="opt.value"
                  class="rounded border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-indigo-500 focus:ring-indigo-500/30"
                  :checked="(formData[q.fieldKey] || '').split(',').includes(opt.value)"
                  @change="toggleCheckbox(q.fieldKey, opt.value)"
                />
                {{ opt.label }}
              </label>
            </div>
            <!-- 成员信息（试答降级为只读提示） -->
            <p
              v-else-if="q.questionType === 'members'"
              class="text-xs text-[var(--color-text-muted)]"
            >
              成员信息（试答不可用）
            </p>
            <!-- 兜底 -->
            <UInput
              v-else
              v-model="formData[q.fieldKey]"
              class="w-full"
              :ui="{ base: 'input-glass' }"
              :placeholder="`请输入${q.title}`"
            />
          </UCard>
        </template>

        <!-- 提交按钮 -->
        <div class="flex items-center justify-end gap-3 pt-1">
          <span class="text-xs text-[var(--color-text-muted)] mr-auto"
            >试答为模拟提交，不会保存数据</span
          >
          <UButton
            color="primary"
            size="lg"
            :loading="submitting"
            class="btn-primary"
            @click="handleSubmit"
          >
            <UIcon name="i-lucide-send" class="w-4 h-4 mr-1" />
            {{ submitting ? '提交中...' : qSubmitText }}
          </UButton>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* 富文本说明渲染样式 */
.qprev-rich :deep(p) {
  margin: 0.25rem 0;
}
.qprev-rich :deep(a) {
  color: #6366f1;
  text-decoration: underline;
  word-break: break-all;
}
.qprev-rich :deep(ul),
.qprev-rich :deep(ol) {
  padding-left: 1.25rem;
  margin: 0.25rem 0;
}
.qprev-rich :deep(code) {
  background: var(--color-bg-tertiary);
  padding: 0.05rem 0.3rem;
  border-radius: 4px;
  font-size: 0.85em;
}
</style>
