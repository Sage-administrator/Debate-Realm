<script setup lang="ts">
// 环节表单组件 - 根据单边发言ui.md / 单边发问ui.md
// 包含：顶部状态栏 + 表单字段区
// 根据环节类型动态切换不同的表单内容

import StageTypeCascader from './StageTypeCascader.vue'
import RolePicker from './RolePicker.vue'

// 环节数据模型
interface StageFormData {
  // 基础
  type: string           // 环节类型（级联选择器的值）
  name: string           // 环节名称
  duration: number       // 时长（秒）
  protectionTime: number // 保护时间（秒，仅发问/对辩）
  // 发言方（单方发言）
  speaker?: string       // 如 "正方·一辩"
  // 发问人 & 接受人（单方发问）
  questioner?: string    // 如 "反方·二辩"
  responder?: string     // 如 "正方·一辩"
  // 率先发言方（自由辩论、双边对辩）
  firstSpeaker?: string  // 如 "正方·一辩"
}

interface Props {
  modelValue: StageFormData
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: StageFormData]
}>()

// 为了便于双向绑定，使用内部 ref + watch
const localData = ref<StageFormData>({
  type: props.modelValue?.type || '',
  name: props.modelValue?.name || '',
  duration: props.modelValue?.duration ?? 180,
  protectionTime: props.modelValue?.protectionTime ?? 0,
  speaker: props.modelValue?.speaker || '正方·一辩',
  questioner: props.modelValue?.questioner || '反方·二辩',
  responder: props.modelValue?.responder || '正方·一辩',
  firstSpeaker: props.modelValue?.firstSpeaker || '正方·一辩',
})

// 当外部 modelValue 变化时更新内部
watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      localData.value = {
        type: val.type || '',
        name: val.name || '',
        duration: val.duration ?? 180,
        protectionTime: val.protectionTime ?? 0,
        speaker: val.speaker || '正方·一辩',
        questioner: val.questioner || '反方·二辩',
        responder: val.responder || '正方·一辩',
        firstSpeaker: val.firstSpeaker || '正方·一辩',
      }
    }
  },
  { deep: true },
)

// 当内部数据变化时，通知父级
watch(
  localData,
  (val) => {
    emit('update:modelValue', { ...val })
  },
  { deep: true },
)

// === 类型判断 ===
function isSpeech(type: string) { return type === 'single_speech' || type === 'speech' }
function isQuestion(type: string) { return type === 'single_question' || type === 'question' }
function isBilateral(type: string) { return type === 'bilateral_debate' || type === 'dual-timer' || type === 'free_debate' }
function isTimerType(type: string) { return type === 'single_timer' || type === 'double_timer' || isSpeech(type) || isQuestion(type) || isBilateral(type) }
function isNoTimer(type: string) { return type === 'no_timer' }
function isPpt(type: string) { return type === 'ppt_replace' }
</script>

<template>
  <div class="stage-form">
    <!-- ======== 表单字段区 ======== -->
    <div class="form-content">

      <!-- ==== 通用字段：环节类型 ==== -->
      <div class="form-field">
        <label class="form-label">环节类型</label>
        <StageTypeCascader v-model="localData.type" placeholder="请选择环节类型" />
      </div>

      <!-- ==== 通用字段：环节名称 ==== -->
      <div class="form-field">
        <label class="form-label">环节名称</label>
        <input
          v-model="localData.name"
          type="text"
          class="form-input"
          :placeholder="isQuestion(localData.type) ? '例如：质询、盘问...' : '例如：开篇陈词...'"
        />
        <p v-if="isQuestion(localData.type)" class="form-hint">例如：质询、盘问...</p>
      </div>

      <!-- ==== 单边发言：角色选择（复合）==== -->
      <div v-if="isSpeech(localData.type)" class="form-field">
        <label class="form-label">发言方</label>
        <RolePicker v-model="localData.speaker" placeholder="请选择发言方" />
        <p class="form-hint">选择正方/反方及辩手编号</p>
      </div>

      <!-- ==== 单边发问：发问人 & 接受人 ==== -->
      <div v-if="isQuestion(localData.type)" class="form-row-2col">
        <div class="form-field">
          <label class="form-label">发问人</label>
          <RolePicker v-model="localData.questioner" placeholder="请选择发问人" />
        </div>
        <div class="form-field">
          <label class="form-label">接受人</label>
          <RolePicker v-model="localData.responder" placeholder="请选择接受人" />
        </div>
      </div>

      <!-- ==== 双边对辩/自由辩论：率先发言方 ==== -->
      <div v-if="isBilateral(localData.type)" class="form-field">
        <label class="form-label">率先发言方</label>
        <RolePicker v-model="localData.firstSpeaker" placeholder="请选择率先发言方" />
      </div>

      <!-- ==== 通用字段：环节时长 + 保护时间 ==== -->
      <div v-if="isTimerType(localData.type)" class="form-row-2col">
        <div class="form-field">
          <label class="form-label">环节时长</label>
          <div class="input-with-suffix">
            <input
              v-model.number="localData.duration"
              type="number"
              min="0"
              class="form-input"
            />
            <span class="input-suffix">秒</span>
          </div>
        </div>

        <!-- 仅发问/对辩类型显示保护时间 -->
        <div v-if="isQuestion(localData.type) || isBilateral(localData.type)" class="form-field">
          <label class="form-label">保护时间</label>
          <div class="input-with-suffix">
            <input
              v-model.number="localData.protectionTime"
              type="number"
              min="0"
              class="form-input"
            />
            <span class="input-suffix">秒</span>
          </div>
          <p class="form-hint">该功能可不启用，设置为0或留空即可</p>
        </div>
      </div>

      <!-- ==== 无计时器/PPT图片时的提示 ==== -->
      <div v-if="isNoTimer(localData.type)" class="form-field">
        <div class="info-note">
          <UIcon name="i-lucide-info" class="info-note-icon" />
          此环节不显示计时器，将仅在时间轴中显示环节标题。
        </div>
      </div>

      <div v-if="isPpt(localData.type)" class="form-field">
        <div class="info-note">
          <UIcon name="i-lucide-image" class="info-note-icon" />
          此环节用于展示图片/PPT内容，不显示计时器。
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ========= 整体容器 ========= */
.stage-form {
  width: 100%;
}

/* 标签通用样式（在卡片头等处使用） */
.status-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  font-size: 14px;
  border-radius: 4px;
  flex-shrink: 0;
  line-height: 1.4;
}

/* 白字深绿底标签（"类"、"时"） */
.status-tag--green {
  color: #FFFFFF;
  background-color: #07C160;
  font-weight: 500;
}

/* 黑字白底/浅灰底标签（"单方发言"/"单方发问"/时间值） */
.status-tag--white {
  color: rgba(255,255,255,0.9);
  background-color: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.15);
  font-weight: 500;
}

.status-tag--time {
  font-variant-numeric: tabular-nums;
  min-width: 48px;
}

/* ========= 表单内容区 ========= */
.form-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 通用字段 */
.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 14px;
  color: rgba(255,255,255,0.7);
  font-weight: 500;
}

.form-input {
  width: 100%;
  height: 48px;
  padding: 0 16px;
  font-size: 16px;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 6px;
  outline: none;
  background: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.9);
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}

.form-input:focus {
  border-color: #07C160;
  box-shadow: 0 0 0 2px rgba(7, 193, 96, 0.2);
}

/* 辅助文本 */
.form-hint {
  font-size: 12px;
  color: rgba(255,255,255,0.4);
  margin-top: 2px;
  line-height: 1.4;
}

/* 双栏布局 */
.form-row-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

/* 带后缀的输入框 */
.input-with-suffix {
  display: flex;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 6px;
  overflow: hidden;
  background: rgba(255,255,255,0.08);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.input-with-suffix:focus-within {
  border-color: #07C160;
  box-shadow: 0 0 0 2px rgba(7, 193, 96, 0.2);
}

.input-with-suffix .form-input {
  flex: 1;
  border: none;
  border-radius: 0;
  height: 46px; /* 减去边框 */
}

.input-suffix {
  width: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255,255,255,0.05);
  border-left: 1px solid rgba(255,255,255,0.15);
  color: rgba(255,255,255,0.7);
  font-size: 16px;
  flex-shrink: 0;
}

/* 提示信息块（无计时器/PPT时） */
.info-note {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background-color: rgba(255,255,255,0.05);
  border: 1px dashed rgba(255,255,255,0.15);
  border-radius: 6px;
  font-size: 14px;
  color: rgba(255,255,255,0.6);
}

.info-note-icon {
  width: 16px;
  height: 16px;
  color: #07C160;
  flex-shrink: 0;
}
</style>
