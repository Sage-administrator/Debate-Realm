<script setup lang="ts">
/**
 * QuestionnaireFill.vue — 通用问卷填写组件
 * 复用于评分问卷（match_score）。按题型渲染输入框，包含 scale 量表题。
 * - audience 来自 questionnaire.settings.audience（public / loggedIn / judges）
 * - 受众拦截：需登录而未登录时显示登录提示
 * - 提交到 /api/tournaments/{tid}/questionnaires/{qid}/submit
 */
import { sanitizeHtml } from '~/utils/richtext'

const props = defineProps<{
  questionnaire: any
  matchId: string
}>()

const emit = defineEmits<{ submitted: [payload: any] }>()

const toast = useToast()
const authStore = useAuthStore()

const questionnaireId = computed(() => props.questionnaire?.id)
const tournamentId = computed(() => props.questionnaire?.tournamentId)
const audience = computed(() => props.questionnaire?.settings?.audience || 'loggedIn')

const questions = computed<any[]>(() =>
  (props.questionnaire?.questions || []).map((q: any) => ({
    ...q,
    // 题目说明（富文本）存于 meta.description
    description: sanitizeHtml(q.meta?.description || ''),
  })),
)

// ── 整卷设置（标题 / 富文本说明 / 提交文案 / 对齐）──
const qSettings = computed(() => props.questionnaire?.settings || {})
const qTitle = computed(() => props.questionnaire?.title || '')
const qDescHtml = computed(() => sanitizeHtml(props.questionnaire?.description || ''))
const qAlign = computed<'left' | 'center' | 'right'>(qSettings.value.align || 'center')
const qAlignClass = computed(
  () => ({ left: 'text-left', center: 'text-center', right: 'text-right' })[qAlign.value],
)
const qSubmitText = computed(() => qSettings.value.submitText || '提交评分')
const qThankYou = computed(
  () => qSettings.value.thankYouText || '感谢您的评分！您可重新提交以更新结果。',
)

// ── 表单状态 ──
const formData = reactive<Record<string, any>>({})
const submitting = ref(false)
const alreadySubmitted = ref(false)

// ── 受众校验 ──
const needsLogin = computed(() => audience.value !== 'public')
const blockedByLogin = computed(() => needsLogin.value && !authStore.user)

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

// ── 量表 meta 解析 ──
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

// 生成量表分值序列
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

// ── 提交 ──
async function handleSubmit() {
  if (blockedByLogin.value) {
    toast.add({ title: '请先登录后再评分', color: 'warning' })
    return
  }
  // 必填校验
  for (const q of questions.value) {
    if (['divider', 'heading'].includes(q.questionType)) continue
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
  try {
    const res = await fetch(
      `/api/tournaments/${tournamentId.value}/questionnaires/${questionnaireId.value}/submit`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
        },
        body: JSON.stringify({ matchId: props.matchId, answers: { ...formData } }),
      },
    )
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.message || '提交失败')
    }
    alreadySubmitted.value = true
    toast.add({ title: data.updated ? '已更新您的评分' : '评分提交成功', color: 'success' })
    emit('submitted', data)
  } catch (e: any) {
    toast.add({ title: e?.message || '提交失败', color: 'error' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div>
    <!-- ═══ 登录拦截 ═══ -->
    <div v-if="blockedByLogin" class="glass-card p-8 text-center">
      <UIcon name="i-lucide-lock" class="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-3" />
      <h3 class="text-base font-semibold text-[var(--color-text-primary)] mb-2">需要登录</h3>
      <p class="text-sm text-[var(--color-text-muted)] mb-4">
        该评分问卷仅限登录用户填写，请先登录。
      </p>
      <UButton color="primary" @click="void navigateTo('/login')">前往登录</UButton>
    </div>

    <!-- ═══ 已提交 ═══ -->
    <div v-else-if="alreadySubmitted" class="glass-card p-8 text-center">
      <div
        class="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-3"
      >
        <UIcon name="i-lucide-check" class="w-8 h-8 text-green-600 dark:text-green-400" />
      </div>
      <h3 class="text-base font-semibold text-[var(--color-text-primary)] mb-1">评分已提交</h3>
      <p class="text-sm text-[var(--color-text-muted)]">{{ qThankYou }}</p>
    </div>

    <!-- ═══ 填写表单 ═══ -->
    <template v-else>
      <!-- 问卷标题与富文本说明 -->
      <div class="mb-5" :class="qAlignClass">
        <h2 v-if="qTitle" class="text-xl font-bold text-[var(--color-text-primary)]">
          {{ qTitle }}
        </h2>
        <div
          v-if="qDescHtml"
          class="qfill-rich mt-2 text-sm text-[var(--color-text-secondary)] leading-relaxed"
          :class="
            qAlign === 'center' ? 'text-center' : qAlign === 'right' ? 'text-right' : 'text-left'
          "
          v-html="qDescHtml"
        />
      </div>

      <div class="space-y-5">
        <template v-for="(q, idx) in questions" :key="q.id || idx">
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
            <!-- 成员信息（评分问卷内降级为只读提示） -->
            <p
              v-else-if="q.questionType === 'members'"
              class="text-xs text-[var(--color-text-muted)]"
            >
              成员信息（本问卷不适用）
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
.qfill-rich :deep(p) {
  margin: 0.25rem 0;
}
.qfill-rich :deep(a) {
  color: #6366f1;
  text-decoration: underline;
  word-break: break-all;
}
.qfill-rich :deep(ul),
.qfill-rich :deep(ol) {
  padding-left: 1.25rem;
  margin: 0.25rem 0;
}
.qfill-rich :deep(code) {
  background: var(--color-bg-tertiary);
  padding: 0.05rem 0.3rem;
  border-radius: 4px;
  font-size: 0.85em;
}
</style>
