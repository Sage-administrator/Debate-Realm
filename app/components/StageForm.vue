<script setup lang="ts">
// 环节表单组件 - 根据环节类型动态展示不同字段
// 单方发言：发言方 + 时长
// 单方发问：发问人 + 接受人 + 提问时长 + 回答时长 + 保护时间
// 双边对辩：正方参与辩手(多选) + 反方参与辩手(多选) + 率先发言方 + 每方时长 + 保护时间

import StageTypeCascader from './StageTypeCascader.vue'
import RolePicker from './RolePicker.vue'
import SpeechRolePicker from './SpeechRolePicker.vue'

interface StageFormData {
  type: string
  name: string
  duration: number
  protectionTime: number
  speaker?: string
  speakerMode?: number       // 0=正常 1=反向
  questioner?: string
  questionerMode?: number
  responders?: string[]      // 单方发问接受人（多选）
  respondersMode?: number
  responder?: string         // [已废弃] 旧数据的单值接受人；新数据用 responders（数组）。读模板/DB 旧字段用
  firstSpeaker?: string
  // 对辩双方参与辩手（多选）
  positiveSpeakers?: string[]
  negativeSpeakers?: string[]
  // 单方发问拆分时长
  questionDuration?: number
  answerDuration?: number
  // 无计时器环节的可发言角色（multi-select，角色 label 列表，用于发言权限联动）
  speakers?: string[]
  // PPT/图片展示环节：上传到 /uploads/images/ 的相对路径（纯播报不计时）
  pptImage?: string
}

interface Props {
  modelValue: StageFormData
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: StageFormData]
}>()

// 上传需要鉴权：PPT 图片上传走 /api/upload（服务端校验 tokenVersion），必须带上 Bearer token
const authStore = useAuthStore()

// 向后兼容：旧数据的 responder 是单值字符串，新数据用 responders（数组）
// 模板/DB 可能提供其中任意一个，这里统一解析为数组
function resolveResponders(mv: StageFormData | null | undefined): string[] {
  if (mv?.responders && mv.responders.length) return [...mv.responders]
  if (mv?.responder && typeof mv.responder === 'string') return [mv.responder]
  return ['正方 · 一辩']
}

const localData = ref<StageFormData>({
  type: props.modelValue?.type || '',
  name: props.modelValue?.name || '',
  duration: props.modelValue?.duration ?? 180,
  protectionTime: props.modelValue?.protectionTime ?? 0,
  speaker: props.modelValue?.speaker || '正方 · 一辩',
  speakerMode: props.modelValue?.speakerMode ?? 0,
  questioner: props.modelValue?.questioner || '反方 · 二辩',
  questionerMode: props.modelValue?.questionerMode ?? 0,
  responders: resolveResponders(props.modelValue),
  respondersMode: props.modelValue?.respondersMode ?? 0,
  firstSpeaker: props.modelValue?.firstSpeaker || '正方 · 一辩',
  positiveSpeakers: props.modelValue?.positiveSpeakers || [],
  negativeSpeakers: props.modelValue?.negativeSpeakers || [],
  questionDuration: props.modelValue?.questionDuration ?? 0,
  answerDuration: props.modelValue?.answerDuration ?? 0,
  speakers: props.modelValue?.speakers ? [...props.modelValue.speakers] : [],
  pptImage: props.modelValue?.pptImage || '',
})

// 环节表单数据深比较：用于双向 watch 的回环保护。
// 父组件（timing 页）在收到 update:modelValue 后会就地修改 stage 并重新下发新的 :model-value 对象，
// 若两个 watch 各自无脑回写就会无限互触发（Maximum recursive updates），并导致 RolePicker 的
// <Transition> 离场被打断、下拉卡在可见状态。只有"值真的变化"时才回写，打断回环。
function stageDataEqual(
  a: StageFormData | null | undefined,
  b: StageFormData | null | undefined,
): boolean {
  if (!a || !b) return a === b
  const keys: (keyof StageFormData)[] = [
    'type', 'name', 'duration', 'protectionTime', 'speaker', 'speakerMode', 'questioner', 'questionerMode',
    'responders', 'respondersMode', 'firstSpeaker', 'positiveSpeakers', 'negativeSpeakers',
    'questionDuration', 'answerDuration', 'pptImage', 'speakers',
  ]
  for (const k of keys) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) return false
  }
  return true
}

watch(
  () => props.modelValue,
  (val) => {
    if (val && !stageDataEqual(val, localData.value)) {
      localData.value = {
        type: val.type || '',
        name: val.name || '',
        duration: val.duration ?? 180,
        protectionTime: val.protectionTime ?? 0,
        speaker: val.speaker || '正方 · 一辩',
        speakerMode: val.speakerMode ?? 0,
        questioner: val.questioner || '反方 · 二辩',
        questionerMode: val.questionerMode ?? 0,
        responders: resolveResponders(val),
        respondersMode: val.respondersMode ?? 0,
        firstSpeaker: val.firstSpeaker || '正方 · 一辩',
        positiveSpeakers: val.positiveSpeakers || [],
        negativeSpeakers: val.negativeSpeakers || [],
        questionDuration: val.questionDuration ?? 0,
        answerDuration: val.answerDuration ?? 0,
        speakers: val.speakers ? [...val.speakers] : [],
        pptImage: val.pptImage || '',
      }
    }
  },
  { deep: true },
)

watch(
  localData,
  (val) => {
    if (!stageDataEqual(val, props.modelValue)) {
      emit('update:modelValue', { ...val })
    }
  },
  { deep: true },
)

// 类型判断函数统一使用 app/utils/stageType.ts（Nuxt 4 自动导入）

// ═══════════ PPT/图片上传 ═══════════
const pptFileInput = ref<HTMLInputElement | null>(null)
const pptUploading = ref(false)

async function onPptFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const fd = new FormData()
  fd.append('file', file)
  fd.append('folder', 'images')
  pptUploading.value = true
  try {
    const headers: Record<string, string> = {}
    if (authStore.token) headers.Authorization = `Bearer ${authStore.token}`
    const res: any = await $fetch('/api/upload', { method: 'POST', body: fd, headers })
    if (res?.success && res?.data?.path) {
      localData.value.pptImage = res.data.path
    } else {
      // 上传失败：提示（不阻断编辑）
      console.error('图片上传失败：', res?.message || '未知错误')
    }
  } catch (err) {
    console.error('图片上传异常：', err)
  } finally {
    pptUploading.value = false
    // 清空 input，允许重复选择同一文件
    if (pptFileInput.value) pptFileInput.value.value = ''
  }
}

function clearPptImage() {
  localData.value.pptImage = ''
}
</script>

<template>
  <div class="stage-form">
    <div class="form-content">

      <!-- 环节类型 -->
      <div class="form-field">
        <label class="form-label">环节类型</label>
        <StageTypeCascader v-model="localData.type" placeholder="请选择环节类型" />
      </div>

      <!-- 环节名称 -->
      <div class="form-field">
        <label class="form-label">环节名称</label>
        <input
          v-model="localData.name"
          type="text"
          class="form-input"
          :placeholder="isQuestion(localData.type) ? '例如：质询、盘问...' : '例如：开篇陈词...'"
        />
      </div>

      <!-- ==== 单方发言：发言方 ==== -->
      <div v-if="isSpeech(localData.type)" class="form-field">
        <label class="form-label">发言方</label>
        <RolePicker v-model="localData.speaker" v-model:mode="localData.speakerMode" multiple reverse placeholder="请选择发言方（可多选，或排除某辩手）" />
        <p class="form-hint">用下拉顶部的「正常 / 排除」切换：正常模式可勾选多位辩手（如"正方 · 一/二辩"）；排除模式下勾选要排除的辩手，其余同方辩手均可发言（获得发言权限）。</p>
      </div>

      <!-- ==== 单方发问：发问人 + 接受人（可多选正常 / 排除模式） ==== -->
      <div v-if="isQuestion(localData.type)" class="form-row-2col">
        <div class="form-field">
          <label class="form-label">发问人</label>
          <RolePicker v-model="localData.questioner" v-model:mode="localData.questionerMode" multiple reverse placeholder="请选择发问人（可多选，或排除某辩手）" />
          <p class="form-hint">下拉顶部「正常 / 排除」切换：正常可勾选多位辩手；排除模式勾选要排除的辩手，其余同方辩手均可发问。</p>
        </div>
        <div class="form-field">
          <label class="form-label">接受人</label>
          <RolePicker v-model="localData.responders" v-model:mode="localData.respondersMode" multiple reverse placeholder="请选择接受人（可多选，或排除某辩手）" />
          <p class="form-hint">下拉顶部「正常 / 排除」切换：正常可勾选多位辩手；排除模式勾选要排除的辩手，其余同方辩手均可接受发问。</p>
        </div>
      </div>

      <!-- ==== 单方发问：提问时长（去除回答时长，环节总时长=提问时长） ==== -->
      <div v-if="isQuestion(localData.type)" class="form-field">
        <label class="form-label">提问时长</label>
        <div class="input-with-suffix">
          <input v-model.number="localData.questionDuration" type="number" min="0" class="form-input" />
          <span class="input-suffix">秒</span>
        </div>
      </div>

      <!-- ==== 双边对辩/自由辩论：正方参与辩手 + 反方参与辩手 ==== -->
      <div v-if="isBilateral(localData.type)" class="form-row-2col">
        <div class="form-field">
          <label class="form-label">正方参与辩手</label>
          <RolePicker v-model="localData.positiveSpeakers" multiple side="positive" placeholder="选择正方辩手" />
        </div>
        <div class="form-field">
          <label class="form-label">反方参与辩手</label>
          <RolePicker v-model="localData.negativeSpeakers" multiple side="negative" placeholder="选择反方辩手" />
        </div>
      </div>

      <!-- ==== 双边对辩/自由辩论：率先发言方 ==== -->
      <div v-if="isBilateral(localData.type)" class="form-field">
        <label class="form-label">率先发言方</label>
        <RolePicker v-model="localData.firstSpeaker" placeholder="请选择率先发言方" />
        <p class="form-hint">从上方已选的参与辩手中选择率先发言的一方</p>
      </div>

      <!-- ==== 通用：环节时长（单方发言/单计时器/双计时器） ==== -->
      <div v-if="isTimerType(localData.type) && !isQuestion(localData.type)" class="form-field">
        <label class="form-label">{{ isDualTimer(localData.type) ? '每方时长' : '环节时长' }}</label>
        <div class="input-with-suffix">
          <input v-model.number="localData.duration" type="number" min="0" class="form-input" />
          <span class="input-suffix">秒</span>
        </div>
      </div>

      <!-- ==== 保护时间（发问/对辩） ==== -->
      <div v-if="isQuestion(localData.type) || isBilateral(localData.type)" class="form-field">
        <label class="form-label">保护时间</label>
        <div class="input-with-suffix">
          <input v-model.number="localData.protectionTime" type="number" min="0" class="form-input" />
          <span class="input-suffix">秒</span>
        </div>
        <p class="form-hint">{{ isQuestion(localData.type) ? '接受人开头 N 秒内不可被打断，0 表示不启用' : '发言方开头 N 秒内不可被打断，0 表示不启用' }}</p>
      </div>

      <!-- ==== 无计时器：发言方（可多选，用于发言权限联动） ==== -->
      <div v-if="isNoTimer(localData.type)" class="form-field">
        <label class="form-label">发言方</label>
        <SpeechRolePicker
          v-model="localData.speakers"
          placeholder="选择可发言的角色（可多选）"
        />
        <p class="form-hint">选择本环节由哪些角色发言（可多选）。计时器运行时将自动套用对应发言权限：被选中的角色可发言（绿），其余不可发言（红）。</p>
      </div>

      <!-- ==== 无计时器/PPT 提示 ==== -->
      <div v-if="isNoTimer(localData.type)" class="form-field">
        <div class="info-note">
          <UIcon name="i-lucide-info" class="info-note-icon" />
          此环节不显示计时器，将仅在时间轴中显示环节标题。
        </div>
      </div>

      <div v-if="isPpt(localData.type)" class="form-field">
        <label class="form-label">发言方</label>
        <SpeechRolePicker
          v-model="localData.speakers"
          placeholder="选择本环节可发言的角色（可多选）"
        />
        <p class="form-hint">选择本环节由哪些角色发言（可多选）。QQ 频道模式下将自动套用对应发言权限：被选中的角色可发言（绿），其余不可发言（红）。</p>
      </div>

      <div v-if="isPpt(localData.type)" class="form-field">
        <label class="form-label">展示图片</label>
        <div class="ppt-upload-row">
          <input
            ref="pptFileInput"
            type="file"
            accept="image/*"
            class="hidden"
            @change="onPptFileChange"
          />
          <button type="button" class="upload-btn" :disabled="pptUploading" @click="pptFileInput?.click()">
            {{ pptUploading ? '上传中…' : '选择图片' }}
          </button>
          <span v-if="localData.pptImage && !pptUploading" class="upload-status success">已上传 ✓</span>
          <button v-if="localData.pptImage" type="button" class="clear-btn" @click="clearPptImage">移除</button>
        </div>
        <div v-if="localData.pptImage" class="ppt-preview">
          <img :src="localData.pptImage" alt="PPT预览" />
        </div>
        <p class="form-hint">
          上传后将在计时器该环节居中展示此图片（纯展示，不计时）。支持 JPG/PNG/GIF，≤10MB。
        </p>
      </div>

      <div v-if="isPpt(localData.type)" class="form-field">
        <div class="info-note">
          <UIcon name="i-lucide-image" class="info-note-icon" />
          此环节用于展示图片/PPT内容，不显示计时器（纯播报）。
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stage-form {
  width: 100%;
}

.form-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 14px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.form-input {
  width: 100%;
  height: 48px;
  padding: 0 16px;
  font-size: 16px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  outline: none;
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}

.form-input:focus {
  border-color: var(--color-accent-primary);
  box-shadow: 0 0 0 2px var(--color-accent-bg);
}

.form-hint {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 2px;
  line-height: 1.4;
}

.form-row-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.input-with-suffix {
  display: flex;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  overflow: hidden;
  background: var(--color-bg-secondary);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.input-with-suffix:focus-within {
  border-color: var(--color-accent-primary);
  box-shadow: 0 0 0 2px var(--color-accent-bg);
}

.input-with-suffix .form-input {
  flex: 1;
  border: none;
  border-radius: 0;
  height: 46px;
}

.input-suffix {
  width: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-bg-tertiary);
  border-left: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: 16px;
  flex-shrink: 0;
}

.info-note {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background-color: var(--color-bg-tertiary);
  border: 1px dashed var(--color-border);
  border-radius: 6px;
  font-size: 14px;
  color: var(--color-text-secondary);
}

.info-note-icon {
  width: 16px;
  height: 16px;
  color: var(--color-success);
  flex-shrink: 0;
}

/* ═══════════ PPT 图片上传 ═══════════ */
.ppt-upload-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.upload-btn {
  height: 40px;
  padding: 0 18px;
  font-size: 14px;
  font-weight: 500;
  color: #fff;
  background-color: var(--color-accent-primary);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s, opacity 0.2s;
}
.upload-btn:hover { opacity: 0.9; }
.upload-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.upload-status {
  font-size: 13px;
}
.upload-status.success {
  color: var(--color-success);
}

.clear-btn {
  height: 40px;
  padding: 0 14px;
  font-size: 14px;
  color: var(--color-text-secondary);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}
.clear-btn:hover {
  border-color: var(--color-danger, #e53e3e);
  color: var(--color-danger, #e53e3e);
}

.ppt-preview {
  margin-top: 10px;
  width: 100%;
  max-height: 220px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  overflow: hidden;
  background: var(--color-bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
}
.ppt-preview img {
  max-width: 100%;
  max-height: 220px;
  object-fit: contain;
}

</style>
