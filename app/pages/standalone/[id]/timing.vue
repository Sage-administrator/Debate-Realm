<!--
  timing.vue - 计时器环节配置页面
  功能：
  - 左侧 TimerPreview 实时预览计时器效果
  - 右侧配置计时器环节（名称、类型、时长等）
  - 支持环节的增删改、排序、上下移动
  - 配置修改实时同步到数据库（timer-config API）
  - 移除导入/导出功能，仅保留配置管理
-->
<script setup lang="ts">
import { computed } from 'vue'
import TimerPreviewCard from '~/components/TimerPreviewCard.vue'
import StageForm from '~/components/StageForm.vue'
import { typeLabel, hasTimer, isDualTimer, normalizeStageType } from '~/utils/stageType'
import { useStageEditor } from '~/composables/useStageEditor'

definePageMeta({ layout: 'standalone' })

// 计时环节配置编辑器：tournaments / standalone 两宿主共享逻辑已抽到 useStageEditor。
// 本页仅作为「单场计时」宿主的薄适配器——注入 standaloneMatch 提供名称回填，hostType 标为 'standalone'。
const route = useRoute()
const standaloneMatch = inject<Ref<any>>('standaloneMatch')!
const matchId = computed(() => route.params.id as string)

const {
  config,
  loading,
  saving,
  previewStageIndex,
  expandedId,
  showTemplateModal,
  dragSourceId,
  dragOverId,
  timerCountTypes,
  speechTypes,
  questionTypes,
  dualTypes,
  debateTemplates,
  loadPageConfig,
  savePageConfig,
  addStageByType,
  removeStage,
  duplicateStage,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  toggleExpand,
  onStageFormUpdate,
  applyTemplate,
  openTemplateModal,
  closeTemplateModal,
  getStageSpeaker,
} = useStageEditor({ hostType: 'standalone', hostNameRef: standaloneMatch })
</script>

<template>
  <template v-if="standaloneMatch">
    <!-- ═══ 主内容：左侧实时预览 + 右侧环节配置（左右并排，左1/3 + 右2/3） ═══ -->
    <div class="py-6 grid grid-cols-12 gap-6">
      <!-- ═══ 左侧：实时预览（左4列，约1/3宽度） ═══ -->
      <div class="col-span-4">
        <TimerPreviewCard
          v-model:stage-index="previewStageIndex"
          :full-config="config"
          :tournament-id="matchId"
          type="standalone"
        />
      </div>

      <!-- ═══ 右侧：环节配置（右8列，约2/3宽度） ═══ -->
      <div class="col-span-8 space-y-4">
        <div class="stages-config-card">
          <div class="flex gap-4 stages-flex-container">
            <!-- 左侧分类栏 -->
            <div class="category-sidebar stages-sidebar-scroll">
              <!-- 计时器数量 -->
              <div class="category-group">
                <h4 class="category-title">
                  <UIcon name="i-lucide-timer" class="w-4 h-4 mr-1" />
                  计时器数量
                </h4>
                <button
                  v-for="item in timerCountTypes"
                  :key="item.type"
                  class="category-btn"
                  @click="addStageByType(item.type, item.name)"
                >
                  <span>{{ item.label }}</span>
                  <span class="text-lg">+</span>
                </button>
              </div>
              <!-- 单方发言 -->
              <div class="category-group">
                <h4 class="category-title">
                  <UIcon name="i-lucide-message-circle" class="w-4 h-4 mr-1" />
                  单方发言
                </h4>
                <button
                  v-for="item in speechTypes"
                  :key="item.name"
                  class="category-btn"
                  @click="addStageByType('single_speech', item.name)"
                >
                  <span>{{ item.name }}</span>
                  <span class="text-lg">+</span>
                </button>
              </div>
              <!-- 单方发问 -->
              <div class="category-group">
                <h4 class="category-title">
                  <UIcon name="i-lucide-help-circle" class="w-4 h-4 mr-1" />
                  单方发问
                </h4>
                <button
                  v-for="item in questionTypes"
                  :key="item.name"
                  class="category-btn"
                  @click="addStageByType('single_question', item.name)"
                >
                  <span>{{ item.name }}</span>
                  <span class="text-lg">+</span>
                </button>
              </div>
              <!-- 双边对辩 -->
              <div class="category-group">
                <h4 class="category-title">
                  <UIcon name="i-lucide-check-circle" class="w-4 h-4 mr-1" />
                  双边对辩
                </h4>
                <button
                  v-for="item in dualTypes"
                  :key="item.name"
                  class="category-btn"
                  @click="addStageByType('bilateral_debate', item.name)"
                >
                  <span>{{ item.name }}</span>
                  <span class="text-lg">+</span>
                </button>
              </div>
            </div>

            <!-- 右侧环节列表 -->
            <div class="flex-1 stages-right-container">
              <!-- 空状态 -->
              <div v-if="config.stages.length === 0" class="empty-state">
                <UIcon name="i-lucide-clock" class="w-10 h-10 mx-auto mb-2 text-white/30" />
                <p>从左侧分类栏添加计时环节</p>
              </div>

              <!-- 环节卡片列表 -->
              <!-- 环节卡片列表（可拖拽排序）-->
              <div class="stages-scroll">
                <!-- 顶部：使用模板按钮（随列表滚动） -->
                <button
                  class="template-btn"
                  @click="
                    () => {
                      showTemplateModal = true
                    }
                  "
                >
                  <UIcon name="i-lucide-download" class="template-btn-icon" />
                  <span>使用模板</span>
                </button>
                <div
                  v-for="(stage, idx) in config.stages"
                  :key="stage.id"
                  class="stage-card"
                  :class="{
                    'stage-card--dragging': dragSourceId === stage.id,
                    'stage-card--over': dragOverId === stage.id,
                  }"
                  draggable="true"
                  @dragstart="onDragStart($event, stage.id)"
                  @dragover.prevent="onDragOver($event, stage.id)"
                  @dragleave="onDragLeave(stage.id)"
                  @drop.prevent="onDrop(stage.id)"
                  @dragend="onDragEnd"
                >
                  <!-- 卡片头（新状态栏风格，可拖拽排序）-->
                  <div class="stage-card-header" @click="toggleExpand(stage.id)">
                    <!-- 拖拽把手 + 序号：用户按住此处拖动 -->
                    <div class="stage-order stage-order--handle" title="拖动调整顺序">
                      <span>{{ idx + 1 }}</span>
                    </div>

                    <!-- 左侧标签组：类/类型/时/时间 -->
                    <div class="stage-header-tags">
                      <span class="status-tag status-tag--green">类</span>
                      <span class="status-tag status-tag--white status-tag--type">{{
                        typeLabel(stage.type)
                      }}</span>
                      <span class="status-tag status-tag--green">时</span>
                      <span
                        v-if="hasTimer(stage.type)"
                        class="status-tag status-tag--white status-tag--time"
                      >
                        {{
                          isDualTimer(stage.type)
                            ? `${stage.positiveDuration ?? stage.duration}/${stage.negativeDuration ?? stage.duration}`
                            : stage.duration
                        }}
                      </span>
                    </div>

                    <!-- 右侧标题：动态文本 -->
                    <div class="stage-header-title">
                      <template v-if="hasTimer(stage.type)">
                        <template
                          v-if="
                            stage.type === 'single_speech' ||
                            stage.type === 'speech' ||
                            stage.type === 'summary'
                          "
                        >
                          {{ (stage.speaker || '正方·一辩').replace(/[·\/\s\-]/g, '') }}·{{
                            stage.name
                          }}
                        </template>
                        <template v-else-if="stage.type === 'single_question'">
                          {{ getStageSpeaker(stage) }}
                        </template>
                        <template v-else-if="isDualTimer(stage.type)">
                          <template v-if="normalizeStageType(stage.type) === 'free_debate'">{{
                            stage.name
                          }}</template>
                          <template v-else
                            >{{ (stage.firstSpeaker || '正方·一辩').replace(/[·\/\s\-]/g, '') }}·{{
                              stage.name
                            }}</template
                          >
                        </template>
                        <template v-else>
                          {{ stage.name }}
                        </template>
                      </template>
                      <template v-else>
                        {{ stage.name }}
                      </template>
                    </div>
                  </div>
                  <!-- 展开的详情（使用新的 StageForm 组件）-->
                  <div v-if="expandedId === stage.id" class="stage-card-body">
                    <!-- 动态表单：根据环节类型展示不同字段 -->
                    <StageForm
                      :model-value="{
                        type: stage.type,
                        name: stage.name,
                        duration: isDualTimer(stage.type)
                          ? (stage.positiveDuration ?? 120)
                          : (stage.duration ?? 180),
                        protectionTime: stage.protectionTime ?? 0,
                        speaker: stage.speaker || '正方 · 一辩',
                        speakerMode: stage.speakerMode ?? 0,
                        questioner: stage.questioner || '反方 · 二辩',
                        questionerMode: stage.questionerMode ?? 0,
                        responder: stage.responder || '正方 · 一辩',
                        responders: stage.responders || null,
                        respondersMode: stage.respondersMode ?? 0,
                        firstSpeaker: stage.firstSpeaker || '正方 · 一辩',
                        positiveSpeakers: stage.positiveSpeakers || [],
                        negativeSpeakers: stage.negativeSpeakers || [],
                        speakers: stage.speakers || [],
                        questionDuration: stage.questionDuration ?? 0,
                        answerDuration: stage.answerDuration ?? 0,
                        pptImage: stage.pptImage || '',
                      }"
                      @update:model-value="(val) => onStageFormUpdate(stage, val)"
                    />

                    <!-- 底部操作按钮 -->
                    <div class="stage-card-actions">
                      <button class="action-btn action-btn--copy" @click.stop="duplicateStage(idx)">
                        <UIcon name="i-lucide-copy" class="w-4 h-4" />
                        复制
                      </button>
                      <button class="action-btn action-btn--delete" @click.stop="removeStage(idx)">
                        <UIcon name="i-lucide-trash-2" class="w-4 h-4" />
                        删除
                      </button>
                    </div>
                  </div>
                </div>

                <!-- 底部：添加一个环节（随列表滚动） -->
                <button class="add-stage-btn" @click="addStageByType('single_speech', '新环节')">
                  <span class="add-stage-plus">＋</span>
                  <span>添加一个环节</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ 模板选择弹窗 ═══ -->
      <div
        v-if="showTemplateModal"
        class="template-modal-mask"
        @click.self="showTemplateModal = false"
      >
        <div class="template-modal">
          <div class="template-modal-header">
            <h3 class="text-lg font-bold text-[var(--color-text-primary)]/90">选择计时器模板</h3>
            <button
              class="template-modal-close"
              @click="
                () => {
                  showTemplateModal = false
                }
              "
            >
              ×
            </button>
          </div>
          <div class="template-modal-body">
            <div v-for="tpl in debateTemplates" :key="tpl.id" class="template-item">
              <div class="template-item-info">
                <div class="template-item-name">{{ tpl.name }}</div>
                <div class="template-item-desc">{{ tpl.description }}</div>
                <div class="template-item-count">共 {{ tpl.stages.length }} 个环节</div>
              </div>
              <button class="template-item-btn" @click="applyTemplate(tpl.id)">使用该模板</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </template>
</template>

<style scoped>
/* 深色玻璃拟态样式已由全局 main.css 中的 .tab-dark-* 类提供，此处无需额外 scoped 样式 */

/* ═══════════ 分类栏与环节配置 ═══════════ */
.category-sidebar {
  width: 11.25rem;
  flex-shrink: 0;
  border-right: 1px solid var(--color-border);
  padding: 0.75rem;
}

.category-group {
  margin-bottom: 1rem;
}

.category-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-muted);
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
}

.category-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.625rem;
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.15s;
  margin-bottom: 0.25rem;
}

.category-btn:hover {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border);
}

.empty-state {
  text-align: center;
  padding: 3.75rem 0;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

/* 环节卡片 —— 可拖拽排序 */
.stage-card {
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  margin-bottom: 0.5rem;
  overflow: hidden;
  cursor: grab;
  transition:
    box-shadow 0.2s,
    border-color 0.2s,
    transform 0.2s,
    opacity 0.2s;
  user-select: none;
}

.stage-card:active {
  cursor: grabbing;
}

.stage-card--dragging {
  opacity: 0.5;
  transform: scale(0.98);
  box-shadow: 0 0.25rem 0.75rem rgba(0, 0, 0, 0.2);
  border-style: dashed;
  border-color: var(--color-accent-primary);
}

.stage-card--over {
  border-color: var(--color-accent-primary);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

.stage-card-header {
  display: flex;
  align-items: center;
  padding: 0.75rem 0.75rem;
  cursor: pointer;
  gap: 0.75rem;
  background-color: rgba(99, 102, 241, 0.08);
  transition: background-color 0.2s;
}

.stage-card-header:hover {
  background-color: rgba(99, 102, 241, 0.15);
}

.stage-order {
  min-width: 2rem;
  height: 2rem;
  border-radius: 0.375rem;
  background: var(--color-accent-primary);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8125rem;
  font-weight: 700;
  flex-shrink: 0;
  cursor: grab;
}

.stage-order:active {
  cursor: grabbing;
}

.stage-header-tags {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
}

.status-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.1875rem 0.5rem;
  font-size: 0.75rem;
  border-radius: 0.25rem;
  flex-shrink: 0;
  line-height: 1.4;
  white-space: nowrap;
}

.status-tag--green {
  color: #ffffff;
  background-color: var(--color-accent-primary);
  font-weight: 500;
}

.status-tag--white {
  color: var(--color-text-secondary);
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  font-weight: 500;
}

.status-tag--type {
  font-size: 0.875rem;
  padding: 0.1875rem 0.625rem;
}

.status-tag--time {
  font-variant-numeric: tabular-nums;
  min-width: 2rem;
}

.stage-header-title {
  flex: 1;
  min-width: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text-primary);
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ═══════════ 卡片展开表单 ═══════════ */
.stage-card-body {
  padding: 1rem 0.75rem 0.75rem;
  border-top: 1px solid var(--color-border);
}

.stage-card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding-top: 1rem;
  margin-top: 1rem;
  border-top: 1px solid var(--color-border);
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
  border: 1px solid var(--color-border);
  border-radius: 0.25rem;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn:hover {
  background: var(--color-bg-secondary);
}

.action-btn--copy:hover {
  color: #60a5fa;
  border-color: #60a5fa;
}

.action-btn--delete:hover {
  color: #f87171;
  border-color: #f87171;
}

/* ═══════════ 使用模板按钮 ═══════════ */
.template-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.3rem 0.75rem;
  border-radius: 0.5rem;
  border: 1.5px dashed var(--color-accent-primary);
  background: transparent;
  color: var(--color-accent-primary);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  margin-bottom: 0.5rem;
}

.template-btn:hover {
  background: rgba(99, 102, 241, 0.06);
  border-color: var(--color-accent-primary);
  color: var(--color-accent-primary);
}

.template-btn-icon {
  width: 0.85rem;
  height: 0.85rem;
}

/* ═══════════ 模板选择弹窗样式 ═══════════ */
.template-modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.template-modal {
  background: var(--color-bg-secondary);
  backdrop-filter: blur(16px);
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  width: 32rem;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.template-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-tertiary);
}

.template-modal-close {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: var(--color-text-muted);
  background: transparent;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.template-modal-close:hover {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.template-modal-body {
  padding: 1rem 1.25rem;
  overflow-y: auto;
  flex: 1;
}

.template-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
  margin-bottom: 0.75rem;
  transition: all 0.15s ease;
}

.template-item:hover {
  border-color: var(--color-accent-primary);
  background: rgba(99, 102, 241, 0.04);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.1);
}

.template-item:last-child {
  margin-bottom: 0;
}

.template-item-info {
  flex: 1;
  min-width: 0;
}

.template-item-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 0.25rem;
}

.template-item-desc {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  margin-bottom: 0.25rem;
}

.template-item-count {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.template-item-btn {
  padding: 0.5rem 1rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-accent-primary);
  background: transparent;
  border: 1.5px solid var(--color-accent-primary);
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.template-item-btn:hover {
  background: var(--color-accent-primary);
  color: #ffffff;
}

/* ═══════════ 添加环节按钮 ═══════════ */
.add-stage-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  border: 1.5px dashed var(--color-border);
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  margin-top: 0.5rem;
}

.add-stage-btn:hover {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border);
  color: var(--color-text-secondary);
}

.add-stage-plus {
  font-size: 1.1rem;
  line-height: 1;
}

/* ═══════════ 高度与溢出控制 ═══════════ */
.stages-config-card {
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  padding: 1rem;
  border-radius: 0.5rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.stages-flex-container {
  position: relative;
  min-height: 0;
}

.category-sidebar {
  position: absolute;
  left: 0;
  top: 0;
  width: 11.25rem;
  height: 100%;
  border-right: 1px solid var(--color-border);
  padding: 0.75rem;
  overflow-y: auto;
  flex-shrink: 0;
}

.stages-right-container {
  margin-left: calc(11.25rem + 1rem);
  min-width: 0;
}

.stages-scroll {
  overflow-y: auto;
  max-height: 72vh;
  padding-bottom: 0.25rem;
}
</style>
