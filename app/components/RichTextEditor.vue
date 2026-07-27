<script setup lang="ts">
/**
 * RichTextEditor.vue — 零依赖富文本编辑器（内容可编辑 + 工具条）
 *
 * 特性：
 * - 加粗 / 斜体 / 下划线 / 删除线
 * - 字号（px 下拉）、文字颜色、背景高亮
 * - 左 / 中 / 右 对齐
 * - 有序 / 无序列表、插入 / 取消超链接
 * - 清除格式、查看 / 编辑 HTML 源码
 * - 输出经 sanitizeHtml 净化的受限 HTML（v-model）
 *
 * 适用场景：问卷说明等由组织者编写的内容，纯前端、不依赖任何第三方库。
 */
import { ref, onMounted, watch } from 'vue'
import { sanitizeHtml, isRich, escapeHtml } from '~/utils/richtext'

const props = withDefaults(defineProps<{
  modelValue?: string
  placeholder?: string
  minHeight?: string
  /** 是否显示工具条（画布内可设 false，仅作只读富文本展示） */
  toolbar?: boolean
}>(), {
  modelValue: '',
  placeholder: '请输入内容…',
  minHeight: '96px',
  toolbar: true,
})

const emit = defineEmits<{ 'update:modelValue': [string] }>()

const editorRef = ref<HTMLDivElement | null>(null)
const showSource = ref(false)
const sourceText = ref('')
const fontSize = ref('')

const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px']

function initialHtml(val: string): string {
  if (!val) return ''
  return isRich(val) ? val : `<p>${escapeHtml(val)}</p>`
}

onMounted(() => {
  if (editorRef.value) editorRef.value.innerHTML = initialHtml(props.modelValue)
})

// 外部 modelValue 变化（如载入模板）同步到编辑器，避免光标回跳
watch(() => props.modelValue, (val) => {
  if (!editorRef.value) return
  const current = editorRef.value.innerHTML
  if (sanitizeHtml(current) !== sanitizeHtml(val || '')) {
    editorRef.value.innerHTML = initialHtml(val || '')
  }
})

function emitValue() {
  if (!editorRef.value) return
  emit('update:modelValue', sanitizeHtml(editorRef.value.innerHTML))
}

function onInput() {
  emitValue()
}

// ── 基础格式（语义标签，最干净）──
function exec(cmd: string, value?: string) {
  editorRef.value?.focus()
  document.execCommand(cmd, false, value)
  onInput()
}
const toggleBold = () => exec('bold')
const toggleItalic = () => exec('italic')
const toggleUnderline = () => exec('underline')
const const_toggleStrike = () => exec('strikeThrough')
const toggleOl = () => exec('insertOrderedList')
const toggleUl = () => exec('insertUnorderedList')
const alignLeft = () => exec('justifyLeft')
const alignCenter = () => exec('justifyCenter')
const alignRight = () => exec('justifyRight')
const clearFormat = () => exec('removeFormat')

// ── 用 span 包裹选区并设置内联样式（字号 / 颜色 / 高亮，跨浏览器可靠）──
function wrapSelection(style: string) {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return
  const range = sel.getRangeAt(0)
  if (range.collapsed) return
  const span = document.createElement('span')
  span.setAttribute('style', style)
  try {
    span.appendChild(range.extractContents())
    range.insertNode(span)
    sel.removeAllRanges()
    const r = document.createRange()
    r.selectNodeContents(span)
    sel.addRange(r)
  } catch { /* 跨节点选区可能失败，忽略 */ }
  onInput()
}

function applyFontSize(size: string) {
  if (size) wrapSelection(`font-size:${size}`)
  fontSize.value = ''
}
function applyColor(e: Event) {
  const v = (e.target as HTMLInputElement).value
  if (v) wrapSelection(`color:${v}`)
}
function applyBg(e: Event) {
  const v = (e.target as HTMLInputElement).value
  if (v) wrapSelection(`background-color:${v}`)
}

// ── 超链接 ──
function applyLink() {
  const url = window.prompt('请输入链接地址（http / https / mailto）：', 'https://')
  if (url === null) return
  let safe = url.trim()
  if (!safe) return
  if (!/^(https?:\/\/|mailto:)/i.test(safe)) safe = `https://${safe}`
  editorRef.value?.focus()
  document.execCommand('createLink', false, safe)
  onInput()
}
const removeLink = () => exec('unlink')

// ── HTML 源码切换 ──
function toggleSource() {
  if (!showSource.value) {
    sourceText.value = editorRef.value?.innerHTML || ''
    showSource.value = true
  } else {
    if (editorRef.value) editorRef.value.innerHTML = sanitizeHtml(sourceText.value)
    showSource.value = false
    onInput()
  }
}
</script>

<template>
  <div class="rte">
    <!-- 工具条 -->
    <div
      v-if="toolbar"
      class="rte-toolbar flex flex-wrap items-center gap-0.5 px-1.5 py-1 border border-[var(--color-border)] border-b-0 rounded-t-md bg-[var(--color-bg-tertiary)]"
    >
      <button type="button" class="rte-btn" title="加粗" @click="toggleBold"><UIcon name="i-lucide-bold" class="w-4 h-4" /></button>
      <button type="button" class="rte-btn" title="斜体" @click="toggleItalic"><UIcon name="i-lucide-italic" class="w-4 h-4" /></button>
      <button type="button" class="rte-btn" title="下划线" @click="toggleUnderline"><UIcon name="i-lucide-underline" class="w-4 h-4" /></button>
      <button type="button" class="rte-btn" title="删除线" @click="const_toggleStrike"><UIcon name="i-lucide-strikethrough" class="w-4 h-4" /></button>

      <span class="rte-sep"></span>

      <select
        v-model="fontSize"
        class="rte-select"
        title="字号"
        @change="applyFontSize(($event.target as HTMLSelectElement).value)"
      >
        <option value="">字号</option>
        <option v-for="s in FONT_SIZES" :key="s" :value="s">{{ s.replace('px', '') }}</option>
      </select>

      <label class="rte-btn rte-color" title="文字颜色">
        <UIcon name="i-lucide-type" class="w-4 h-4" />
        <input type="color" class="rte-color-input" @input="applyColor" />
      </label>
      <label class="rte-btn rte-color" title="背景高亮">
        <UIcon name="i-lucide-highlighter" class="w-4 h-4" />
        <input type="color" class="rte-color-input" @input="applyBg" />
      </label>

      <span class="rte-sep"></span>

      <button type="button" class="rte-btn" title="左对齐" @click="alignLeft"><UIcon name="i-lucide-align-left" class="w-4 h-4" /></button>
      <button type="button" class="rte-btn" title="居中" @click="alignCenter"><UIcon name="i-lucide-align-center" class="w-4 h-4" /></button>
      <button type="button" class="rte-btn" title="右对齐" @click="alignRight"><UIcon name="i-lucide-align-right" class="w-4 h-4" /></button>

      <span class="rte-sep"></span>

      <button type="button" class="rte-btn" title="有序列表" @click="toggleOl"><UIcon name="i-lucide-list-ordered" class="w-4 h-4" /></button>
      <button type="button" class="rte-btn" title="无序列表" @click="toggleUl"><UIcon name="i-lucide-list" class="w-4 h-4" /></button>

      <span class="rte-sep"></span>

      <button type="button" class="rte-btn" title="插入链接" @click="applyLink"><UIcon name="i-lucide-link" class="w-4 h-4" /></button>
      <button type="button" class="rte-btn" title="取消链接" @click="removeLink"><UIcon name="i-lucide-unlink" class="w-4 h-4" /></button>
      <button type="button" class="rte-btn" title="清除格式" @click="clearFormat"><UIcon name="i-lucide-eraser" class="w-4 h-4" /></button>

      <span class="rte-sep"></span>

      <button type="button" class="rte-btn" title="查看/编辑 HTML" @click="toggleSource"><UIcon name="i-lucide-code" class="w-4 h-4" /></button>
    </div>

    <!-- 富文本编辑区 -->
    <div
      v-show="!showSource"
      ref="editorRef"
      class="rte-editor"
      :class="toolbar ? 'rounded-b-md' : 'rounded-md'"
      contenteditable="true"
      :data-placeholder="placeholder"
      :style="{ minHeight }"
      @input="onInput"
    ></div>

    <!-- HTML 源码 -->
    <textarea
      v-if="showSource"
      v-model="sourceText"
      class="rte-source fd-input"
      :style="{ minHeight }"
      spellcheck="false"
      placeholder="在此直接编辑 HTML…"
    ></textarea>
  </div>
</template>

<style scoped>
.rte-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background-color 0.12s, color 0.12s;
}
.rte-btn:hover {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}
.rte-sep {
  width: 1px;
  height: 18px;
  margin: 0 3px;
  background: var(--color-border);
}
.rte-select {
  height: 28px;
  max-width: 64px;
  font-size: 11px;
  color: var(--color-text-secondary);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  outline: none;
  cursor: pointer;
}
.rte-select:hover { border-color: var(--color-border-accented); }
.rte-color {
  position: relative;
  overflow: hidden;
}
.rte-color-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  border: none;
  padding: 0;
}
.rte-editor {
  padding: 0.5rem 0.625rem;
  font-size: 0.8125rem;
  line-height: 1.6;
  color: var(--color-text-primary);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s, background-color 0.15s;
  overflow-y: auto;
}
.rte-editor:focus {
  border-color: var(--color-accent-primary);
  background: var(--color-bg-tertiary);
  box-shadow: 0 0 0 2px var(--color-accent-bg);
}
.rte-editor:empty::before {
  content: attr(data-placeholder);
  color: var(--color-text-muted);
  pointer-events: none;
}
.rte-editor :deep(a) {
  color: #818cf8;
  text-decoration: underline;
}
.rte-editor :deep(ul),
.rte-editor :deep(ol) {
  padding-left: 1.4rem;
  margin: 0.25rem 0;
}
.rte-source {
  width: 100%;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  resize: vertical;
}
</style>
