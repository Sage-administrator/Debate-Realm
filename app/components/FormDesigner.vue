<script setup lang="ts">
/**
 * FormDesigner.vue — 拖拽式表单设计器（深色版）
 * 参考：腾讯问卷编辑器三栏布局，配色适配项目深色玻璃拟态主题
 *
 * 三栏布局：
 * - 左侧（200px）：题型选择面板（按分类分组，点击/拖拽添加）
 * - 中央（Flex:1）：问卷画布（深色纸张、拖拽排序、点击选中）
 * - 右侧（280px）：设置面板（整卷/题目 Tab 切换）
 *
 * 顶部内嵌工具条：标题、字段计数、试答/发布按钮（占位）
 *
 * 使用 vue-draggable-plus 实现拖拽排序
 */
import { VueDraggable } from 'vue-draggable-plus'
import QuestionnairePreview from './QuestionnairePreview.vue'
import RichTextEditor from './RichTextEditor.vue'
import { sanitizeHtml } from '~/utils/richtext'

// ── Props & Emits ──
const props = withDefaults(defineProps<{
  modelValue: any[]  // 字段列表
  formSettings?: any // 整卷设置（标题/说明/提交文案/对齐等）
}>(), {
  formSettings: () => ({
    title: '问卷标题',
    description: '感谢您参与本次调查，您的意见对我们非常重要。',
    allowSubmit: true,
    showProgress: true,
    shuffleQuestions: false,
    submitText: '提交',
    thankYouText: '感谢您的参与！',
    align: 'center',
    showNumber: true,
  }),
})

const emit = defineEmits<{
  'update:modelValue': [fields: any[]]
  'update:formSettings': [settings: any]
}>()

// 整卷设置（本地状态，与 prop 同步；确保新增字段有默认值）
const formSettings = reactive({ ...(props.formSettings || {}) })
Object.assign(formSettings, {
  submitText: props.formSettings?.submitText ?? '提交',
  thankYouText: props.formSettings?.thankYouText ?? '感谢您的参与！',
  align: props.formSettings?.align ?? 'center',
  showNumber: props.formSettings?.showNumber ?? true,
})

// 本地变化同步到外部（克隆，避免与父级 v-model:form-settings 形成引用环）
watch(formSettings, () => {
  emit('update:formSettings', { ...formSettings })
}, { deep: true })

// 父级重新载入（如打开设计器载入模板）时同步外部变更
watch(() => props.formSettings, (v) => {
  if (!v) return
  for (const k of Object.keys(v)) {
    if ((formSettings as any)[k] !== (v as any)[k]) (formSettings as any)[k] = (v as any)[k]
  }
}, { deep: true })

// ── 字段类型定义 ──
interface FieldTypeDef {
  type: string
  label: string
  icon: string
  category: 'choice' | 'text' | 'advanced' | 'special' | 'layout'
  defaultName: string
  defaultKey?: string  // 系统字段的预设 key
  systemField?: boolean
}

// 字段类型库（按腾讯问卷风格分类，仅包含项目实际支持的类型）
const fieldTypeLibrary: FieldTypeDef[] = [
  // ── 选择 ──
  { type: 'radio', label: '单选', icon: 'i-lucide-circle-dot', category: 'choice', defaultName: '单选题' },
  { type: 'checkbox', label: '多选', icon: 'i-lucide-check-square', category: 'choice', defaultName: '多选题' },
  { type: 'select', label: '下拉', icon: 'i-lucide-list', category: 'choice', defaultName: '下拉题' },
  // ── 文本输入 ──
  { type: 'text', label: '单行文本', icon: 'i-lucide-type', category: 'text', defaultName: '单行文本' },
  { type: 'textarea', label: '多行文本', icon: 'i-lucide-align-left', category: 'text', defaultName: '多行文本' },
  // ── 高级题型 ──
  { type: 'number', label: '数字', icon: 'i-lucide-hash', category: 'advanced', defaultName: '数字' },
  { type: 'date', label: '日期/时间', icon: 'i-lucide-calendar', category: 'advanced', defaultName: '日期/时间' },
  { type: 'phone', label: '手机号', icon: 'i-lucide-smartphone', category: 'advanced', defaultName: '手机号' },
  { type: 'email', label: '邮箱', icon: 'i-lucide-mail', category: 'advanced', defaultName: '邮箱' },
  { type: 'scale', label: '量表', icon: 'i-lucide-star', category: 'advanced', defaultName: '量表题' },
  // ── 特殊业务 ──
  { type: 'members', label: '成员信息', icon: 'i-lucide-users', category: 'special', defaultName: '成员信息' },
  // ── 描述分页 ──
  { type: 'heading', label: '分组标题', icon: 'i-lucide-heading', category: 'layout', defaultName: '分组标题' },
  { type: 'divider', label: '分割线', icon: 'i-lucide-minus', category: 'layout', defaultName: '分割线' },
]

// 按分类分组
const fieldCategories = computed(() => [
  { key: 'choice', label: '选择', items: fieldTypeLibrary.filter(f => f.category === 'choice') },
  { key: 'text', label: '文本输入', items: fieldTypeLibrary.filter(f => f.category === 'text') },
  { key: 'advanced', label: '高级题型', items: fieldTypeLibrary.filter(f => f.category === 'advanced') },
  { key: 'special', label: '特殊业务', items: fieldTypeLibrary.filter(f => f.category === 'special') },
  { key: 'layout', label: '描述分页', items: fieldTypeLibrary.filter(f => f.category === 'layout') },
])

// ── 字段列表（本地状态，与 v-model 同步） ──
const fields = ref<any[]>(props.modelValue.map((f: any) => ({ ...f })))

// 监听 props 变化（外部加载后同步到本地）
watch(() => props.modelValue, (val) => {
  if (val === fields.value) return
  fields.value = val.map((f: any) => ({ ...f }))
}, { deep: true })

// 同步本地变化到外部
function syncToParent() {
  emit('update:modelValue', [...fields.value])
}

// ── 当前选中字段的索引 ──
const selectedIndex = ref<number | null>(null)

// ── 试答预览弹窗 ──
const showTrial = ref(false)
const selectedField = computed(() => selectedIndex.value !== null ? fields.value[selectedIndex.value] || null : null)

// ── 量表 meta（确保为对象，便于 v-model 绑定）──
const scaleMeta = computed<any>({
  get() {
    if (!selectedField.value) return { min: 1, max: 5, step: 1, leftLabel: '差', rightLabel: '好' }
    const m = selectedField.value.meta
    if (!m || typeof m !== 'object') {
      selectedField.value.meta = { min: 1, max: 5, step: 1, leftLabel: '差', rightLabel: '好' }
    }
    return selectedField.value.meta
  },
  set(v) {
    if (selectedField.value) selectedField.value.meta = v
  },
})

// ── 右侧面板 Tab：整卷设置 / 题目设置 ──
const settingsTab = ref<'form' | 'field'>('field')

// 选中字段时自动切换到题目 Tab
watch(selectedIndex, (val) => {
  if (val !== null) settingsTab.value = 'field'
})

// ponytail: 安全解析选项 JSON，消除 3 处重复的 try-catch
function parseOptions(fieldOptions: string | null | undefined): string[] {
  if (!fieldOptions) return []
  try {
    const parsed = JSON.parse(fieldOptions)
    if (Array.isArray(parsed)) {
      return parsed.map((item: any) => typeof item === 'string' ? item : item.label)
    }
  } catch { /* 忽略解析错误 */ }
  return []
}

// ponytail: 生成唯一 fieldKey，消除 2 处重复逻辑
function genUniqueFieldKey(prefix: string): string {
  const existingKeys = new Set(fields.value.map(f => f.fieldKey))
  let key = `${prefix}_${Date.now().toString(36)}`
  let counter = 0
  while (existingKeys.has(key)) {
    counter++
    key = `${prefix}_${Date.now().toString(36)}_${counter}`
  }
  return key
}

// ── 添加字段到列表末尾 ──
function addField(typeDef: FieldTypeDef) {
  const fieldKey = genUniqueFieldKey(`field_${typeDef.type}`)
  const isChoiceType = ['select', 'radio', 'checkbox'].includes(typeDef.type)
  const isScaleType = typeDef.type === 'scale'
  const newField: any = {
    id: '',
    fieldName: typeDef.defaultName,
    fieldKey,
    fieldType: typeDef.type,
    fieldOptions: isChoiceType ? JSON.stringify(['选项1', '选项2', '选项3']) : null,
    required: false,
    sortOrder: fields.value.length,
    appliesTo: 'both',
    placeholder: '',
    description: '',
    width: 'full',
    systemField: false,
    meta: null,
  }
  // 量表题：初始化默认配置（1-5，端点标签 差/好）
  if (isScaleType) {
    newField.fieldName = '请为本次比赛打分'
    newField.meta = { min: 1, max: 5, step: 1, leftLabel: '差', rightLabel: '好' }
  }
  fields.value.push(newField)
  selectedIndex.value = fields.value.length - 1
  syncToParent()
}

// ── 删除字段 ──
function removeField(idx: number) {
  const field = fields.value[idx]
  if (field?.systemField) return
  fields.value.splice(idx, 1)
  if (selectedIndex.value === idx) {
    selectedIndex.value = null
  } else if (selectedIndex.value !== null && selectedIndex.value > idx) {
    selectedIndex.value--
  }
  syncToParent()
}

// ── 选项操作（select/radio/checkbox）──
function addOption(fieldIdx: number) {
  const field = fields.value[fieldIdx]
  if (!field) return
  const options = parseOptions(field.fieldOptions)
  options.push('选项')
  field.fieldOptions = JSON.stringify(options)
  syncToParent()
}

function removeOption(fieldIdx: number, optIdx: number) {
  const field = fields.value[fieldIdx]
  if (!field) return
  const options = parseOptions(field.fieldOptions)
  if (options.length > 1) {
    options.splice(optIdx, 1)
    field.fieldOptions = JSON.stringify(options)
    syncToParent()
  }
}

function updateOption(fieldIdx: number, optIdx: number, value: string) {
  const field = fields.value[fieldIdx]
  if (!field) return
  const options = parseOptions(field.fieldOptions)
  options[optIdx] = value
  field.fieldOptions = JSON.stringify(options)
  syncToParent()
}

// ── 复制字段 ──
function duplicateField(idx: number) {
  const field = fields.value[idx]
  if (!field || field.systemField) return
  const copy = { ...field, id: '' }
  copy.fieldKey = genUniqueFieldKey(`${field.fieldKey}_copy`)
  copy.fieldName = `${field.fieldName}（副本）`
  fields.value.splice(idx + 1, 0, copy)
  selectedIndex.value = idx + 1
  syncToParent()
}

// ── 选中字段 ──
function selectField(idx: number) {
  selectedIndex.value = idx
}

// ── 拖拽排序结束 ──
function onDragEnd() {
  fields.value.forEach((f, i) => { f.sortOrder = i })
  syncToParent()
}

// ── 字段类型标签/图标映射 ──
const typeLabelMap: Record<string, string> = {
  text: '单行文本', textarea: '多行文本', select: '下拉选择',
  radio: '单选', checkbox: '多选', number: '数字', date: '日期',
  phone: '电话', email: '邮箱', members: '成员信息',
  heading: '分组标题', divider: '分割线', scale: '量表',
}

const typeIconMap: Record<string, string> = {
  text: 'i-lucide-type', textarea: 'i-lucide-align-left', select: 'i-lucide-chevron-down-square',
  radio: 'i-lucide-circle-dot', checkbox: 'i-lucide-check-square', number: 'i-lucide-hash',
  date: 'i-lucide-calendar', phone: 'i-lucide-phone', email: 'i-lucide-mail',
  members: 'i-lucide-users', heading: 'i-lucide-heading', divider: 'i-lucide-minus',
  scale: 'i-lucide-star',
}

// 解析量表 meta（兜底默认值）
function parseScaleMeta(field: any) {
  const m = field?.meta && typeof field.meta === 'object' ? field.meta : {}
  return {
    min: typeof m.min === 'number' ? m.min : 1,
    max: typeof m.max === 'number' ? m.max : 5,
    step: typeof m.step === 'number' ? m.step : 1,
    leftLabel: m.leftLabel || '差',
    rightLabel: m.rightLabel || '好',
  }
}

// ── 选项编辑（文本域形式）──
function getOptionsString(field: any): string {
  return parseOptions(field.fieldOptions).join('\n')
}

function setOptionsFromString(field: any, text: string) {
  const options = text.split('\n').map(s => s.trim()).filter(Boolean)
  field.fieldOptions = options.length > 0 ? JSON.stringify(options) : null
}

// ── 属性面板更新时同步 ──
function onFieldUpdate() {
  syncToParent()
}

// 画布列表里题目说明的净化预览（避免直接显示 HTML 标签）
function fieldDescHtml(field: any): string {
  const d = field?.description || ''
  return d ? sanitizeHtml(d) : ''
}

// ── 当前选中题型在左侧面板的高亮 ──
const activeFieldType = computed(() => selectedField.value?.fieldType || '')
</script>

<template>
  <!-- ═══ 问卷设计器容器（深色三栏 SaaS 布局） ═══ -->
  <div class="fd-container flex flex-col h-full min-h-[640px] rounded-xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg-secondary)] backdrop-blur-md">

    <!-- ═══════════ 顶部导航栏 ═══════════ -->
    <header class="fd-header flex items-center justify-between h-12 px-4 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
      <!-- 左：Logo + 步骤条 -->
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
          <UIcon name="i-lucide-file-edit" class="w-4 h-4" />
          <span class="text-xs font-medium text-[var(--color-text-primary)]">问卷编辑器</span>
        </div>
        <!-- 步骤条 -->
        <nav class="flex items-center gap-3 text-xs">
          <span class="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
            <span class="w-1 h-1 rounded-full bg-indigo-400"></span>
            编辑
          </span>
          <span class="text-[var(--color-border-muted)]">/</span>
          <span class="text-[var(--color-text-muted)]">分享</span>
          <span class="text-[var(--color-border-muted)]">/</span>
          <span class="text-[var(--color-text-muted)]">统计</span>
        </nav>
      </div>
      <!-- 右：开关 + 按钮 -->
      <div class="flex items-center gap-3">
        <!-- 允许提交开关 -->
        <label class="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] cursor-pointer">
          <span>允许提交</span>
          <span class="relative inline-block w-8 h-4">
            <input v-model="formSettings.allowSubmit" type="checkbox" class="sr-only peer" />
            <span class="block w-8 h-4 bg-[var(--color-bg-tertiary)] rounded-full peer-checked:bg-indigo-500 transition-colors"></span>
            <span class="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform peer-checked:translate-x-4"></span>
          </span>
        </label>
        <!-- 试答按钮（幽灵） -->
        <button
          type="button"
          class="px-3 py-1 text-xs text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          @click="showTrial = true"
        >
          试答
        </button>
        <!-- 发布按钮（主要） -->
        <button class="px-3 py-1 text-xs text-white bg-indigo-500 hover:bg-indigo-600 rounded transition-colors">
          发布并分享
        </button>
      </div>
    </header>

    <!-- ═══════════ 主体：水平三栏布局 ═══════════ -->
    <div class="fd-body flex flex-1 min-h-0">

      <!-- ═══ 左侧：题型选择面板（200px） ═══ -->
      <aside class="fd-left w-[200px] shrink-0 overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] py-3">
        <div
          v-for="cat in fieldCategories"
          :key="cat.key"
          class="mb-3"
        >
          <!-- 分组标题 -->
          <p class="px-4 mb-1 text-[11px] text-[var(--color-text-muted)]">{{ cat.label }}</p>
          <!-- 题型列表项 -->
          <button
            v-for="item in cat.items"
            :key="item.type"
            type="button"
            class="w-full flex items-center gap-2 h-9 pl-4 pr-3 text-left text-sm transition-colors cursor-grab active:cursor-grabbing group"
            :class="[
              activeFieldType === item.type
                ? 'bg-indigo-500/15 text-[var(--color-accent-primary)] border-l-[3px] border-indigo-400'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] border-l-[3px] border-transparent'
            ]"
            @click="addField(item)"
          >
            <UIcon
              :name="item.icon"
              class="w-4 h-4 shrink-0"
              :class="activeFieldType === item.type ? 'text-[var(--color-accent-primary)]' : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)]'"
            />
            <span class="truncate">{{ item.label }}</span>
          </button>
        </div>
      </aside>

      <!-- ═══ 中央：画布区 ═══ -->
      <div class="fd-canvas flex-1 min-w-0 overflow-y-auto p-6 md:p-8 bg-[var(--color-bg-primary)] relative">
        <!-- 装饰性几何图形（左下角淡色圆） -->
        <div class="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-indigo-500/5 blur-2xl pointer-events-none"></div>

        <!-- 问卷纸张容器 -->
        <div class="fd-paper mx-auto max-w-[800px] min-h-[600px] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-xl p-8 md:p-10 relative">

          <!-- 问卷大标题 -->
          <input
            v-model="formSettings.title"
            type="text"
            class="w-full text-center text-2xl font-bold text-[var(--color-text-primary)] bg-transparent border-none outline-none focus:bg-[var(--color-bg-tertiary)] rounded py-1 transition-colors"
            placeholder="问卷标题"
          />
          <!-- 引导语（富文本） -->
          <div class="mt-3 mb-8">
            <RichTextEditor
              v-model="formSettings.description"
              :min-height="'64px'"
              placeholder="问卷说明文字（支持加粗、字号、超链接等）"
            />
          </div>

          <!-- 字段列表（可拖拽排序） -->
          <VueDraggable
            v-model="fields"
            :animation="200"
            handle=".drag-handle"
            ghost-class="fd-ghost"
            chosen-class="fd-chosen"
            @end="onDragEnd"
            class="space-y-3"
          >
            <div
              v-for="(field, idx) in fields"
              :key="field.id || `new-${idx}`"
              :class="[
                'group relative rounded-md border transition-all duration-150 cursor-pointer',
                selectedIndex === idx
                  ? 'border-indigo-500 bg-indigo-500/[0.08] ring-1 ring-indigo-500/30'
                  : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]'
              ]"
              @click="selectField(idx)"
            >
              <!-- 装饰元素：分割线 -->
              <div v-if="field.fieldType === 'divider'" class="flex items-center px-3 py-3 group">
                <UIcon name="i-lucide-grip-vertical" class="drag-handle w-4 h-4 text-[var(--color-border-muted)] cursor-grab active:cursor-grabbing shrink-0" />
                <div class="flex-1 mx-3 border-t border-[var(--color-border)]"></div>
                <!-- 删除按钮（hover 显示） -->
                <button
                  type="button"
                  class="p-1 rounded text-red-500 dark:text-red-400/60 hover:text-red-500 dark:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="删除"
                  @click.stop="removeField(idx)"
                >
                  <UIcon name="i-lucide-trash-2" class="w-3.5 h-3.5" />
                </button>
              </div>

              <!-- 装饰元素：分组标题 -->
              <div v-else-if="field.fieldType === 'heading'" class="flex items-center px-3 py-3 group">
                <UIcon name="i-lucide-grip-vertical" class="drag-handle w-4 h-4 text-[var(--color-border-muted)] cursor-grab active:cursor-grabbing shrink-0" />
                <UIcon :name="typeIconMap[field.fieldType]" class="w-4 h-4 text-[var(--color-accent-primary)] mx-2 shrink-0" />
                <span class="text-sm font-semibold text-[var(--color-text-primary)] truncate flex-1">{{ field.fieldName || '未命名标题' }}</span>
                <!-- 删除按钮（hover 显示） -->
                <button
                  type="button"
                  class="p-1 rounded text-red-500 dark:text-red-400/60 hover:text-red-500 dark:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="删除"
                  @click.stop="removeField(idx)"
                >
                  <UIcon name="i-lucide-trash-2" class="w-3.5 h-3.5" />
                </button>
              </div>

              <!-- 普通字段 -->
              <div v-else class="flex items-start gap-2 px-3 py-3">
                <!-- 拖拽手柄 -->
                <UIcon
                  name="i-lucide-grip-vertical"
                  class="drag-handle w-4 h-4 mt-1 text-[var(--color-border-muted)] cursor-grab active:cursor-grabbing hover:text-[var(--color-text-muted)] shrink-0"
                />
                <!-- 题号 -->
                <span class="text-xs font-bold text-[var(--color-text-muted)] mt-1 shrink-0 w-6">
                  {{ String(idx + 1).padStart(2, '0') }}
                </span>
                <!-- 字段内容 -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5">
                    <UIcon :name="typeIconMap[field.fieldType] || 'i-lucide-square'" class="w-4 h-4 text-[var(--color-accent-primary)]/80 shrink-0" />
                    <!-- 题目名称：点击可直接编辑，无需切换到右侧面板 -->
                    <input
                      v-model="field.fieldName"
                      type="text"
                      class="flex-1 min-w-0 bg-transparent border-none outline-none text-sm font-medium text-[var(--color-text-primary)] rounded px-1 py-0.5 -mx-1 -my-0.5 transition-colors focus:bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-tertiary)] cursor-text"
                      placeholder="请输入题目标题"
                      @input="onFieldUpdate"
                    />
                    <!-- 必填星号 -->
                    <span v-if="field.required" class="text-red-500 dark:text-red-400 text-sm">*</span>
                    <!-- 系统字段锁标 -->
                    <UIcon v-if="field.systemField" name="i-lucide-lock" class="w-3 h-3 text-[var(--color-text-muted)]" />
                  </div>
                  <!-- 占位提示 / 描述 -->
                  <p v-if="field.placeholder" class="mt-1 text-xs text-[var(--color-text-muted)] truncate">
                    {{ field.placeholder }}
                  </p>
                  <p
                    v-else-if="fieldDescHtml(field)"
                    class="mt-1 text-xs text-[var(--color-text-muted)] line-clamp-2 fd-field-desc"
                    v-html="fieldDescHtml(field)"
                  ></p>
                  <!-- 选项预览（select/radio/checkbox）：改为可直接编辑 -->
                  <div v-if="['select', 'radio', 'checkbox'].includes(field.fieldType)" class="mt-2 space-y-2">
                    <!-- 当前选项列表（全部显示，不再限制只显示前3个） -->
                    <div
                      v-for="(opt, oIdx) in parseOptions(field.fieldOptions)"
                      :key="oIdx"
                      class="flex items-center gap-2 h-11 px-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-tertiary)] hover:border-[var(--color-border)] transition-colors group"
                    >
                      <!-- 单选/多选图标 -->
                      <span class="w-4 h-4 border border-white/30 rounded-full shrink-0"></span>
                      <!-- 选项输入框 -->
                      <input
                        :value="opt"
                        type="text"
                        class="flex-1 bg-transparent border-none outline-none text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
                        placeholder="选项"
                        @input="(e) => updateOption(idx, oIdx, (e.target as HTMLInputElement).value)"
                      />
                      <!-- 删除选项按钮 -->
                      <button
                        type="button"
                        class="p-1 text-[var(--color-border-muted)] hover:text-red-500 dark:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        @click="removeOption(idx, oIdx)"
                      >
                        <UIcon name="i-lucide-x" class="w-4 h-4" />
                      </button>
                    </div>
                    <!-- 添加选项按钮 -->
                    <button
                      type="button"
                      class="flex items-center gap-1 px-3 py-2 text-xs text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 rounded-lg hover:bg-indigo-500/10 transition-colors"
                      @click="addOption(idx)"
                    >
                      <UIcon name="i-lucide-plus" class="w-3 h-3" />添加选项
                    </button>
                  </div>
                  <!-- 量表预览（scale）：只读分值按钮 + 端点标签 -->
                  <div v-if="field.fieldType === 'scale'" class="mt-3">
                    <div class="flex items-center justify-between mb-1.5">
                      <span class="text-xs text-[var(--color-text-muted)]">{{ parseScaleMeta(field).leftLabel }}</span>
                      <span class="text-xs text-[var(--color-text-muted)]">{{ parseScaleMeta(field).rightLabel }}</span>
                    </div>
                    <div class="flex flex-wrap gap-1.5">
                      <span
                        v-for="n in (parseScaleMeta(field).max - parseScaleMeta(field).min + 1)"
                        :key="n"
                        class="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-sm text-[var(--color-text-secondary)]"
                      >{{ parseScaleMeta(field).min + n - 1 }}</span>
                    </div>
                  </div>
                  <!-- 字段元信息：仅显示题型中文标签，不暴露 fieldKey（开发态信息） -->
                  <div class="flex items-center gap-2 mt-1.5">
                    <span class="text-[10px] text-[var(--color-text-muted)]">{{ typeLabelMap[field.fieldType] || field.fieldType }}</span>
                  </div>
                </div>
                <!-- 操作按钮 -->
                <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    v-if="!field.systemField"
                    type="button"
                    class="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]"
                    title="复制"
                    @click.stop="duplicateField(idx)"
                  >
                    <UIcon name="i-lucide-copy" class="w-3.5 h-3.5" />
                  </button>
                  <button
                    v-if="!field.systemField"
                    type="button"
                    class="p-1 rounded text-red-500 dark:text-red-400/60 hover:text-red-500 dark:text-red-400 hover:bg-red-500/10"
                    title="删除"
                    @click.stop="removeField(idx)"
                  >
                    <UIcon name="i-lucide-trash-2" class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </VueDraggable>

          <!-- 空状态提示 -->
          <div v-if="fields.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
            <UIcon name="i-lucide-mouse-pointer-click" class="w-10 h-10 text-[var(--color-border-muted)] mb-3" />
            <p class="text-sm text-[var(--color-text-muted)] mb-1">从左侧添加题型开始设计问卷</p>
            <p class="text-xs text-[var(--color-text-muted)]">点击或拖拽题型即可添加</p>
          </div>

          <!-- 页码指示器 -->
          <div class="mt-8 pt-4 border-t border-[var(--color-border-muted)] text-center">
            <span class="text-[11px] text-[var(--color-text-muted)]">第 1 页 / 共 1 页 （{{ fields.length }} 题）</span>
          </div>
        </div>
      </div>

      <!-- ═══ 右侧：设置面板（280px） ═══ -->
      <aside class="fd-right w-[280px] shrink-0 overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <!-- Tab 切换 -->
        <div class="flex h-10 border-b border-[var(--color-border)]">
          <button
            type="button"
            :class="[
              'flex-1 text-xs transition-colors border-b-2',
              settingsTab === 'form'
                ? 'text-indigo-600 dark:text-indigo-400 border-indigo-400'
                : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-secondary)]'
            ]"
            @click="() => { settingsTab = 'form' }"
          >整卷设置</button>
          <button
            type="button"
            :class="[
              'flex-1 text-xs transition-colors border-b-2',
              settingsTab === 'field'
                ? 'text-indigo-600 dark:text-indigo-400 border-indigo-400'
                : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-secondary)]'
            ]"
            @click="() => { settingsTab = 'field' }"
          >题目设置</button>
        </div>

        <!-- 整卷设置 -->
        <div v-if="settingsTab === 'form'" class="p-4 space-y-4">
          <div>
            <label class="block text-xs text-[var(--color-text-secondary)] mb-1">问卷标题</label>
            <input
              v-model="formSettings.title"
              type="text"
              class="fd-input"
              placeholder="问卷标题"
            />
          </div>
          <div>
            <label class="block text-xs text-[var(--color-text-secondary)] mb-1">问卷说明（富文本）</label>
            <RichTextEditor
              v-model="formSettings.description"
              :min-height="'120px'"
              placeholder="问卷说明文字（支持加粗、字号、超链接等）"
            />
          </div>

          <!-- 提交按钮文案 -->
          <div>
            <label class="block text-xs text-[var(--color-text-secondary)] mb-1">提交按钮文案</label>
            <input
              v-model="formSettings.submitText"
              type="text"
              class="fd-input"
              placeholder="提交"
            />
          </div>

          <!-- 完成致谢语 -->
          <div>
            <label class="block text-xs text-[var(--color-text-secondary)] mb-1">完成致谢语</label>
            <input
              v-model="formSettings.thankYouText"
              type="text"
              class="fd-input"
              placeholder="感谢您的参与！"
            />
          </div>

          <!-- 标题对齐 -->
          <div>
            <label class="block text-xs text-[var(--color-text-secondary)] mb-1">标题对齐</label>
            <div class="grid grid-cols-3 gap-1.5">
              <button
                v-for="opt in [{ v: 'left', l: '左' }, { v: 'center', l: '居中' }, { v: 'right', l: '右' }]"
                :key="opt.v"
                type="button"
                :class="[
                  'h-8 text-xs rounded border transition-colors',
                  formSettings.align === opt.v
                    ? 'border-indigo-500 bg-indigo-600 text-white dark:bg-indigo-500/15 dark:text-indigo-300'
                    : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                ]"
                @click="formSettings.align = opt.v"
              >{{ opt.l }}</button>
            </div>
          </div>

          <!-- 显示题号 -->
          <div class="flex items-center justify-between h-8">
            <label class="text-xs text-[var(--color-text-secondary)]">显示题号</label>
            <span class="relative inline-block w-9 h-5">
              <input type="checkbox" v-model="formSettings.showNumber" class="sr-only peer" />
              <span class="block w-9 h-5 bg-[var(--color-bg-tertiary)] rounded-full peer-checked:bg-indigo-500 transition-colors"></span>
              <span class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></span>
            </span>
          </div>

          <!-- 开关组 -->
          <div class="space-y-2 pt-2">
            <label class="flex items-center justify-between h-8 text-xs text-[var(--color-text-secondary)]">
              <span>允许多次提交</span>
              <span class="relative inline-block w-8 h-4">
                <input v-model="formSettings.allowSubmit" type="checkbox" class="sr-only peer" />
                <span class="block w-8 h-4 bg-[var(--color-bg-tertiary)] rounded-full peer-checked:bg-indigo-500 transition-colors"></span>
                <span class="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform peer-checked:translate-x-4"></span>
              </span>
            </label>
            <label class="flex items-center justify-between h-8 text-xs text-[var(--color-text-secondary)]">
              <span>显示进度条</span>
              <span class="relative inline-block w-8 h-4">
                <input v-model="formSettings.showProgress" type="checkbox" class="sr-only peer" />
                <span class="block w-8 h-4 bg-[var(--color-bg-tertiary)] rounded-full peer-checked:bg-indigo-500 transition-colors"></span>
                <span class="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform peer-checked:translate-x-4"></span>
              </span>
            </label>
            <label class="flex items-center justify-between h-8 text-xs text-[var(--color-text-secondary)]">
              <span>题目随机排序</span>
              <span class="relative inline-block w-8 h-4">
                <input v-model="formSettings.shuffleQuestions" type="checkbox" class="sr-only peer" />
                <span class="block w-8 h-4 bg-[var(--color-bg-tertiary)] rounded-full peer-checked:bg-indigo-500 transition-colors"></span>
                <span class="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform peer-checked:translate-x-4"></span>
              </span>
            </label>
          </div>
        </div>

        <!-- 题目设置 -->
        <div v-else class="p-4 space-y-4">
          <!-- 未选中字段提示 -->
          <div v-if="!selectedField" class="flex flex-col items-center justify-center py-12 text-center">
            <UIcon name="i-lucide-settings-2" class="w-8 h-8 text-[var(--color-border-muted)] mb-2" />
            <p class="text-xs text-[var(--color-text-muted)]">点击画布中的题目编辑属性</p>
          </div>

          <!-- 字段属性编辑表单 -->
          <div v-else class="space-y-4">
            <!-- 字段名称 -->
            <div v-if="!['divider'].includes(selectedField.fieldType)">
              <label class="block text-xs text-[var(--color-text-secondary)] mb-1">题目名称</label>
              <input
                v-model="selectedField.fieldName"
                type="text"
                class="fd-input"
                placeholder="题目显示名称"
                @input="onFieldUpdate"
              />
            </div>

            <!-- 字段 Key 输入已移除：字段标识为开发态信息，不在客户端暴露；后端会自动生成唯一 key -->

            <!-- 占位提示 -->
            <div v-if="['text', 'textarea', 'number', 'phone', 'email', 'date'].includes(selectedField.fieldType)">
              <label class="block text-xs text-[var(--color-text-secondary)] mb-1">占位提示</label>
              <input
                v-model="selectedField.placeholder"
                type="text"
                class="fd-input"
                placeholder="输入框占位文字"
                @input="onFieldUpdate"
              />
            </div>

            <!-- 字段描述（富文本，所有题型通用） -->
            <div>
              <label class="block text-xs text-[var(--color-text-secondary)] mb-1">题目说明（富文本）</label>
              <RichTextEditor
                v-model="selectedField.description"
                :min-height="'80px'"
                placeholder="帮助文字（支持加粗、字号、超链接等）"
                @update:modelValue="onFieldUpdate"
              />
            </div>

            <!-- 选项编辑 -->
            <div v-if="['select', 'radio', 'checkbox'].includes(selectedField.fieldType)">
              <label class="block text-xs text-[var(--color-text-secondary)] mb-1">
                选项列表
                <span class="text-[var(--color-text-muted)]">（每行一个）</span>
              </label>
              <textarea
                :value="getOptionsString(selectedField)"
                @input="setOptionsFromString(selectedField, ($event.target as HTMLTextAreaElement).value); onFieldUpdate()"
                rows="4"
                class="fd-input resize-none"
                placeholder="每行一个选项"
              ></textarea>
            </div>

            <!-- 量表设置（scale）-->
            <div v-if="selectedField.fieldType === 'scale'" class="space-y-3">
              <p class="text-xs text-[var(--color-text-secondary)] font-medium">量表设置</p>
              <div class="grid grid-cols-3 gap-1.5">
                <div>
                  <label class="block text-[11px] text-[var(--color-text-muted)] mb-1">最小值</label>
                  <input
                    v-model.number="scaleMeta.min"
                    type="number"
                    class="fd-input"
                    @input="onFieldUpdate"
                  />
                </div>
                <div>
                  <label class="block text-[11px] text-[var(--color-text-muted)] mb-1">最大值</label>
                  <input
                    v-model.number="scaleMeta.max"
                    type="number"
                    class="fd-input"
                    @input="onFieldUpdate"
                  />
                </div>
                <div>
                  <label class="block text-[11px] text-[var(--color-text-muted)] mb-1">步长</label>
                  <input
                    v-model.number="scaleMeta.step"
                    type="number"
                    class="fd-input"
                    @input="onFieldUpdate"
                  />
                </div>
              </div>
              <div class="grid grid-cols-2 gap-1.5">
                <div>
                  <label class="block text-[11px] text-[var(--color-text-muted)] mb-1">左端标签</label>
                  <input
                    v-model="scaleMeta.leftLabel"
                    type="text"
                    class="fd-input"
                    placeholder="差"
                    @input="onFieldUpdate"
                  />
                </div>
                <div>
                  <label class="block text-[11px] text-[var(--color-text-muted)] mb-1">右端标签</label>
                  <input
                    v-model="scaleMeta.rightLabel"
                    type="text"
                    class="fd-input"
                    placeholder="好"
                    @input="onFieldUpdate"
                  />
                </div>
              </div>
              <!-- 量表预览 -->
              <div class="flex items-center justify-between pt-1">
                <span class="text-[11px] text-[var(--color-text-muted)]">{{ scaleMeta.leftLabel || '左' }}</span>
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="n in (Number(scaleMeta.max) - Number(scaleMeta.min) + 1)"
                    :key="n"
                    class="w-7 h-7 flex items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] text-xs text-[var(--color-text-secondary)]"
                  >{{ Number(scaleMeta.min) + n - 1 }}</span>
                </div>
                <span class="text-[11px] text-[var(--color-text-muted)]">{{ scaleMeta.rightLabel || '右' }}</span>
              </div>
            </div>

            <!-- 字段宽度 -->
            <div v-if="!['divider', 'heading', 'members'].includes(selectedField.fieldType)">
              <label class="block text-xs text-[var(--color-text-secondary)] mb-1">字段宽度</label>
              <div class="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  :class="[
                    'h-8 text-xs rounded border transition-colors',
                    selectedField.width === 'half'
                      ? 'border-indigo-500 bg-indigo-600 text-white dark:bg-indigo-500/15 dark:text-indigo-300'
                      : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                  ]"
                  @click="() => { selectedField.width = 'half'; onFieldUpdate() }"
                >半宽</button>
                <button
                  type="button"
                  :class="[
                    'h-8 text-xs rounded border transition-colors',
                    (selectedField.width === 'full' || !selectedField.width)
                      ? 'border-indigo-500 bg-indigo-600 text-white dark:bg-indigo-500/15 dark:text-indigo-300'
                      : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                  ]"
                  @click="() => { selectedField.width = 'full'; onFieldUpdate() }"
                >全宽</button>
              </div>
            </div>

            <!-- 必填开关 -->
            <div v-if="!['divider', 'heading'].includes(selectedField.fieldType)" class="flex items-center justify-between h-8">
              <label class="text-xs text-[var(--color-text-secondary)]">必填字段</label>
              <span class="relative inline-block w-9 h-5">
                <input type="checkbox" v-model="selectedField.required" class="sr-only peer" @change="onFieldUpdate" />
                <span class="block w-9 h-5 bg-[var(--color-bg-tertiary)] rounded-full peer-checked:bg-indigo-500 transition-colors"></span>
                <span class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4"></span>
              </span>
            </div>

            <!-- 系统字段提示 -->
            <div v-if="selectedField.systemField" class="p-2 rounded bg-amber-500/10 border border-amber-500/20">
              <p class="text-[11px] text-amber-700/80 dark:text-amber-300/80 flex items-start gap-1">
                <UIcon name="i-lucide-info" class="w-3 h-3 mt-0.5 shrink-0" />
                <span>系统字段：不可删除、不可修改类型和标识。可调整显示名、必填、适用类型等。</span>
              </p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>

  <!-- ═══ 试答预览弹窗（受访者视角，纯前端模拟） ═══ -->
  <UModal
    v-model:open="showTrial"
    :title="`试答预览 · ${formSettings.title || '问卷标题'}`"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <div class="max-h-[70vh] overflow-y-auto pr-1">
        <QuestionnairePreview
          :fields="fields"
          :title="formSettings.title"
          :description="formSettings.description"
          :settings="formSettings"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
/* ═══ 问卷设计器深色主题样式 ═══ */

/* ponytail: 使用 CSS 变量，支持深浅色模式 */
.fd-input {
  width: 100%;
  padding: 0.375rem 0.625rem;
  font-size: 0.8125rem;
  color: var(--color-text-primary);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s, background-color 0.15s;
}
.fd-input::placeholder {
  color: var(--color-text-muted);
}
.fd-input:hover {
  border-color: var(--color-border-accented);
}
.fd-input:focus {
  border-color: var(--color-accent-primary);
  background: var(--color-bg-tertiary);
  box-shadow: 0 0 0 2px var(--color-accent-bg);
}

/* 画布列表里的题目说明富文本预览 */
.fd-field-desc :deep(a) {
  color: #818cf8;
  text-decoration: underline;
}
.fd-field-desc :deep(ul),
.fd-field-desc :deep(ol) {
  padding-left: 1rem;
}
.fd-field-desc :deep(p) {
  margin: 0.15rem 0;
}

/* 拖拽占位符（虚线占位框） */
:deep(.fd-ghost) {
  opacity: 0.4;
  background: rgba(99, 102, 241, 0.08) !important;
  border: 1px dashed #6366f1 !important;
  border-radius: 6px;
}

/* 拖拽选中态 */
:deep(.fd-chosen) {
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.4);
}

/* 滚动条细化 */
.fd-left::-webkit-scrollbar,
.fd-canvas::-webkit-scrollbar,
.fd-right::-webkit-scrollbar {
  width: 4px;
}
.fd-left::-webkit-scrollbar-thumb,
.fd-canvas::-webkit-scrollbar-thumb,
.fd-right::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 2px;
}
.fd-left::-webkit-scrollbar-thumb:hover,
.fd-canvas::-webkit-scrollbar-thumb:hover,
.fd-right::-webkit-scrollbar-thumb:hover {
  background: var(--color-border-accented);
}
</style>
