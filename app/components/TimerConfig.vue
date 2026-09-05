<script setup lang="ts">
// 计时器环节配置组件 - 按 计时器环节UI.md 双栏：配置源列表 + 时间轴
const toast = useToast()
const store = useAuthStore()

const props = defineProps<{ tournamentId: string }>() // 当前赛事 ID
const emit = defineEmits<{ saved: [] }>() // 保存成功后触发

// ── 环节数据类型 ──
interface TimerPhase {
  id: string // 环节唯一标识
  type: string // 环节类型（如 single_speech、free_debate 等）
  name: string // 环节名称（如"立论""对辩"）
  questioner?: string // 发问方（仅 single_question 类型）
  responder?: string // 接受方（仅 single_question 类型）
  firstSpeaker?: string // 率先发言方（仅 free_debate 类型）
  duration: number // 环节时长（秒）
  protectionTime: number // 保护时间（秒）
  isSurprise: boolean // 是否为奇袭环节
}

// ── 环节类型分组（按L377-567规格：emoji标题 + action-row列表项）──
interface PhaseGroupItem {
  label: string // 列表项展示文本
  type: string // 对应的环节类型 value
  presetName?: string // 预设环节名称（如"立论"）
  custom?: boolean // 是否为自定义名称项
}

const phaseGroups: { icon: string; label: string; items: PhaseGroupItem[] }[] = [
  {
    icon: '⚙️',
    label: '计时器数量',
    items: [
      { label: '无计时器', type: 'no_timer' },
      { label: '单计时器', type: 'single_timer' },
      { label: '双计时器', type: 'double_timer' },
    ],
  },
  {
    icon: '💬',
    label: '单方发言',
    items: [
      { label: '立论', type: 'single_speech', presetName: '立论' },
      { label: '驳论', type: 'single_speech', presetName: '驳论' },
      { label: '小结', type: 'single_speech', presetName: '小结' },
      { label: '总结陈词', type: 'single_speech', presetName: '总结陈词' },
      { label: '自定义名称', type: 'single_speech', custom: true },
    ],
  },
  {
    icon: '❓',
    label: '单方发问',
    items: [
      { label: '质询', type: 'single_question', presetName: '质询' },
      { label: '盘问', type: 'single_question', presetName: '盘问' },
      { label: '自定义名称', type: 'single_question', custom: true },
    ],
  },
  {
    icon: '🗣️',
    label: '双边对辩',
    items: [
      { label: '对辩', type: 'bilateral_debate', presetName: '对辩' },
      { label: '自由辩论', type: 'free_debate', presetName: '自由辩论' },
      { label: '自定义名称', type: 'bilateral_debate', custom: true },
    ],
  },
  {
    icon: '🖼️',
    label: 'PPT图片',
    items: [{ label: 'PPT平替', type: 'ppt_replace', presetName: 'PPT展示' }],
  },
]

// ── 工具函数 ──
// ponytail: 预构建 Map，O(1) 查找替代每次遍历数组
const typeLabelMap = new Map<string, string>()
for (const g of phaseGroups) {
  for (const item of g.items) {
    if (!item.custom) typeLabelMap.set(item.type, item.label)
  }
}
function getTypeLabel(type: string): string {
  return typeLabelMap.get(type) ?? type
}

// 根据环节类型返回对应颜色（用于类型标签底色）
const typeColorMap: Record<string, string> = {
  single_speech: '#10B981',
  single_question: '#10B981',
  bilateral_debate: '#10B981',
  free_debate: '#10B981',
  no_timer: '#3B82F6',
  single_timer: '#3B82F6',
  double_timer: '#3B82F6',
  ppt_replace: '#8B5CF6',
}
function getTypeColor(type: string): string {
  return typeColorMap[type] || '#9CA3AF'
}

// ── 状态 ──
const phases = ref<TimerPhase[]>([])
const loading = ref(false)
const saving = ref(false)
const expandedId = ref<string | null>(null)

// 级联选择器（仍保留用于环节类型修改）
const showCascaderFor = ref<string | null>(null)
const cascaderCategory = ref('')
const cascaderCategories = [
  {
    label: '常规',
    value: 'regular',
    items: [
      { label: '单方发言', value: 'single_speech', desc: '一方单独发言，正方或反方轮流' },
      { label: '单方发问', value: 'single_question', desc: '一方向另一方提问' },
      { label: '双边对辩', value: 'bilateral_debate', desc: '双方交替辩论' },
      { label: '自由辩论', value: 'free_debate', desc: '自由辩论环节' },
    ],
  },
  {
    label: '基类',
    value: 'base',
    items: [
      { label: '无计时器', value: 'no_timer', desc: '不设置计时器' },
      { label: '单计时器', value: 'single_timer', desc: '单个倒计时' },
      { label: '双计时器', value: 'double_timer', desc: '正反方各有独立计时器' },
    ],
  },
  {
    label: 'PPT图片',
    value: 'image',
    items: [{ label: 'PPT平替', value: 'ppt_replace', desc: '使用图片替代PPT展示' }],
  },
]

// ── 加载/保存 ──
async function loadTemplate() {
  loading.value = true
  try {
    const res = await $fetch<any>(`/api/tournaments/${props.tournamentId}/timer-template`, {
      headers: { Authorization: `Bearer ${store.token}` },
    })
    if (res.phases) phases.value = JSON.parse(res.phases)
  } catch {
    phases.value = []
  } finally {
    loading.value = false
  }
}

async function saveTemplate() {
  saving.value = true
  try {
    await $fetch(`/api/tournaments/${props.tournamentId}/timer-template`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${store.token}` },
      body: { phases: JSON.stringify(phases.value) },
    })
    toast.add({ title: '环节配置已保存', color: 'success' })
    emit('saved')
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '保存失败', color: 'error' })
  } finally {
    saving.value = false
  }
}

// ── 添加环节 ──
function addPhase(predefined: {
  label: string
  type: string
  presetName?: string
  custom?: boolean
}) {
  const phaseName = predefined.custom ? predefined.label : predefined.presetName || predefined.label
  const newPhase: TimerPhase = {
    id: crypto.randomUUID(),
    type: predefined.type,
    name: phaseName,
    duration: predefined.type === 'no_timer' || predefined.type === 'ppt_replace' ? 0 : 180,
    protectionTime: 0,
    isSurprise: false,
  }
  if (predefined.type === 'single_question') {
    newPhase.questioner = '正方'
    newPhase.responder = '反方'
  }
  if (predefined.type === 'free_debate') {
    newPhase.firstSpeaker = '正方'
  }
  phases.value.push(newPhase)
  expandedId.value = newPhase.id
}

// ── 删除/复制/移动环节 ──
function removePhase(id: string) {
  phases.value = phases.value.filter((p) => p.id !== id)
  if (expandedId.value === id) expandedId.value = null
}
function duplicatePhase(phase: TimerPhase) {
  const copy: TimerPhase = {
    ...JSON.parse(JSON.stringify(phase)),
    id: crypto.randomUUID(),
    name: phase.name + ' (副本)',
  }
  const idx = phases.value.findIndex((p) => p.id === phase.id)
  phases.value.splice(idx + 1, 0, copy)
  expandedId.value = copy.id
}
function movePhase(id: string, direction: 'up' | 'down') {
  const idx = phases.value.findIndex((p) => p.id === id)
  if (idx < 0) return
  const target = direction === 'up' ? idx - 1 : idx + 1
  if (target < 0 || target >= phases.value.length) return
  const item = phases.value[idx]
  if (!item) return
  phases.value.splice(idx, 1)
  phases.value.splice(target, 0, item)
}

// ── 级联选择器 ──
function openCascader(phaseId: string) {
  showCascaderFor.value = phaseId
  cascaderCategory.value = ''
}
function selectCascaderCategory(cat: string) {
  cascaderCategory.value = cat
}
function selectCascaderItem(type: string) {
  const phase = phases.value.find((p) => p.id === showCascaderFor.value)
  if (!phase) return
  phase.type = type
  phase.name = getTypeLabel(type)
  phase.duration = type === 'no_timer' || type === 'ppt_replace' ? 0 : 180
  phase.protectionTime = 0
  phase.isSurprise = false
  if (type === 'single_question') {
    phase.questioner = '正方'
    phase.responder = '反方'
    delete phase.firstSpeaker
  } else if (type === 'free_debate') {
    phase.firstSpeaker = '正方'
    delete phase.questioner
    delete phase.responder
  } else {
    delete phase.questioner
    delete phase.responder
    delete phase.firstSpeaker
  }
  showCascaderFor.value = null
}

// ── 显隐条件 ──
// 是否显示环节时长（无计时器/PPT 不显示）
function showDuration(type: string) {
  return !['no_timer', 'ppt_replace'].includes(type)
}
// 是否显示发问人/接受人（仅单方发问）
function showQuestioner(type: string) {
  return type === 'single_question'
}
// 是否显示率先发言方（仅自由辩论）
function showFirstSpeaker(type: string) {
  return type === 'free_debate'
}
// 是否显示保护时间（仅单方发问/双边对辩）
function showProtection(type: string) {
  return ['single_question', 'bilateral_debate'].includes(type)
}
// 是否显示奇袭开关（仅基础计时器类型）
function showSurprise(type: string) {
  return ['no_timer', 'single_timer', 'double_timer'].includes(type)
}

onMounted(() => loadTemplate())
</script>

<template>
  <!-- 加载状态 -->
  <div v-if="loading" class="flex justify-center py-16">
    <UIcon name="i-lucide-loader" class="w-6 h-6 animate-spin text-gray-400" />
  </div>

  <!-- ═══════ 主内容：单列移动端优先（按 L377-567 规格）═══════ -->
  <div v-else class="timer-config">
    <!-- ═══ 环节类型选择器：按 L377-567 规格 ═══ -->
    <div class="config-source">
      <div v-for="(group, gIdx) in phaseGroups" :key="group.label">
        <!-- 分组标题：18px Bold #000000，左侧 emoji 图标 -->
        <p class="section-header" :style="{ marginTop: gIdx === 0 ? '0' : '24px' }">
          <span class="section-icon">{{ group.icon }}</span>
          {{ group.label }}
        </p>
        <!-- 列表项：48px 高，8px 圆角，#E0E0E0 边框，白色背景 -->
        <div class="action-rows">
          <button
            v-for="item in group.items"
            :key="item.label"
            class="action-row"
            @click="addPhase(item)"
          >
            <span class="action-label">{{ item.label }}</span>
            <!-- + 号 / → 箭头 -->
            <span v-if="!item.custom" class="action-plus">+</span>
            <span v-else class="action-arrow">→</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ═══ 已添加环节时间轴 ═══ -->
    <div class="timeline-section">
      <!-- 预设模板按钮 -->
      <button class="use-preset-btn">+ 使用预设模板</button>

      <!-- 空状态 -->
      <div v-if="!phases.length" class="empty-state">
        <UIcon name="i-lucide-clock" class="w-8 h-8 mx-auto mb-2 text-gray-300" />
        点击上方环节类型添加计时环节
      </div>

      <!-- 环节卡片列表 -->
      <div
        v-for="(phase, idx) in phases"
        :key="phase.id"
        class="phase-card"
        :class="expandedId === phase.id ? 'phase-card--expanded' : ''"
      >
        <!-- 卡片头 -->
        <div
          class="phase-card-header"
          :class="expandedId === phase.id ? 'phase-card-header--active' : ''"
          @click="
            () => {
              expandedId = expandedId === phase.id ? null : phase.id
            }
          "
        >
          <div class="sort-btns">
            <button class="sort-btn" @click.stop="movePhase(phase.id, 'up')">▲</button>
            <button class="sort-btn" @click.stop="movePhase(phase.id, 'down')">▼</button>
          </div>
          <span
            class="phase-index"
            :style="{ backgroundColor: expandedId === phase.id ? '#10B981' : '#4B5563' }"
            >{{ idx + 1 }}</span
          >
          <span class="phase-type-tag" :style="{ backgroundColor: getTypeColor(phase.type) }">
            {{ getTypeLabel(phase.type) }}
          </span>
          <span class="phase-name">{{ phase.name }}</span>
          <span v-if="showDuration(phase.type)" class="phase-duration">{{ phase.duration }}秒</span>
          <UIcon
            name="i-lucide-chevron-down"
            class="chevron-icon"
            :class="expandedId === phase.id ? 'rotate-180' : ''"
          />
        </div>

        <!-- 卡片体（展开时） -->
        <div v-if="expandedId === phase.id" class="phase-card-body">
          <div class="form-grid">
            <!-- 环节类型 -->
            <div class="form-field">
              <label class="form-label">环节类型</label>
              <div class="cascader-wrap">
                <button class="cascader-trigger" @click.stop="openCascader(phase.id)">
                  <span :class="phase.type ? 'text-gray-800' : 'text-gray-400'">
                    {{ phase.type ? getTypeLabel(phase.type) : '请选择环节类型' }}
                  </span>
                  <UIcon name="i-lucide-chevron-down" class="w-4 h-4 text-gray-400" />
                </button>
                <!-- 级联菜单 -->
                <div v-if="showCascaderFor === phase.id" class="cascader-dropdown" @click.stop>
                  <div class="cascader-left">
                    <div
                      v-for="cat in cascaderCategories"
                      :key="cat.value"
                      class="cascader-cat"
                      :class="cascaderCategory === cat.value ? 'cascader-cat--active' : ''"
                      @click="selectCascaderCategory(cat.value)"
                    >
                      {{ cat.label }}
                      <UIcon
                        v-if="cascaderCategory === cat.value"
                        name="i-lucide-chevron-right"
                        class="w-3.5 h-3.5"
                      />
                    </div>
                  </div>
                  <div class="cascader-right">
                    <div v-if="!cascaderCategory" class="cascader-placeholder">请选择类别</div>
                    <template
                      v-for="cat in cascaderCategories.filter((c) => c.value === cascaderCategory)"
                      :key="'items-' + cat.value"
                    >
                      <div
                        v-for="item in cat.items"
                        :key="item.value"
                        class="cascader-item"
                        :class="phase.type === item.value ? 'cascader-item--active' : ''"
                        @click="selectCascaderItem(item.value)"
                      >
                        <p>{{ item.label }}</p>
                        <p class="cascader-desc">{{ item.desc }}</p>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </div>

            <!-- 环节名称 -->
            <div class="form-field">
              <label class="form-label">环节名称</label>
              <input
                v-model="phase.name"
                type="text"
                placeholder="请输入该环节的环节名"
                class="form-input"
                :class="!phase.name.trim() ? 'form-input--error' : ''"
              />
              <p class="form-hint">例如：立论、对辩、结辩</p>
            </div>

            <!-- 发问人/接受人 -->
            <div v-if="showQuestioner(phase.type)" class="form-row-2col">
              <div class="form-field">
                <label class="form-label">发问人</label>
                <USelect
                  v-model="phase.questioner"
                  :items="[
                    { label: '正方', value: '正方' },
                    { label: '反方', value: '反方' },
                  ]"
                  class="w-full"
                />
              </div>
              <div class="form-field">
                <label class="form-label">接受人</label>
                <USelect
                  v-model="phase.responder"
                  :items="[
                    { label: '正方', value: '正方' },
                    { label: '反方', value: '反方' },
                  ]"
                  class="w-full"
                />
              </div>
            </div>

            <!-- 率先发言方 -->
            <div v-if="showFirstSpeaker(phase.type)" class="form-field">
              <label class="form-label">率先发言方</label>
              <USelect
                v-model="phase.firstSpeaker"
                :items="[
                  { label: '正方', value: '正方' },
                  { label: '反方', value: '反方' },
                ]"
                class="w-full"
              />
            </div>

            <!-- 环节时长 + 保护时间 -->
            <div v-if="showDuration(phase.type)" class="form-row-2col">
              <div class="form-field">
                <label class="form-label">环节时长</label>
                <div class="input-with-unit">
                  <input v-model.number="phase.duration" type="number" min="0" class="form-input" />
                  <span class="input-unit">秒</span>
                </div>
              </div>
              <div v-if="showProtection(phase.type)" class="form-field">
                <label class="form-label">保护时间</label>
                <div class="input-with-unit">
                  <input
                    v-model.number="phase.protectionTime"
                    type="number"
                    min="0"
                    class="form-input"
                  />
                  <span class="input-unit">秒</span>
                </div>
                <p class="form-hint">设置为0或留空即可不启用</p>
              </div>
            </div>

            <!-- 奇袭开关 -->
            <div v-if="showSurprise(phase.type)" class="surprise-row">
              <div>
                <p class="surprise-title">设为奇袭</p>
                <p class="surprise-desc">开启后该环节可作为奇袭使用</p>
              </div>
              <button
                type="button"
                class="toggle-switch"
                :class="phase.isSurprise ? 'toggle-switch--on' : ''"
                @click="
                  () => {
                    phase.isSurprise = !phase.isSurprise
                  }
                "
              >
                <span class="toggle-knob" />
              </button>
            </div>

            <!-- 卡片底部操作 -->
            <div class="card-footer">
              <button class="footer-btn footer-btn--danger" @click.stop="removePhase(phase.id)">
                <UIcon name="i-lucide-trash-2" class="w-3.5 h-3.5" />删除
              </button>
              <button class="footer-btn" @click.stop="duplicatePhase(phase)">
                <UIcon name="i-lucide-copy" class="w-3.5 h-3.5" />复制
              </button>
              <button class="footer-btn footer-btn--outline" @click.stop="expandedId = null">
                收起
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部保存操作 -->
      <div class="bottom-actions">
        <button
          class="add-more-btn"
          @click="addPhase({ label: '单方发言', type: 'single_speech' })"
        >
          + 添加一个环节
        </button>
        <button class="save-btn" :disabled="saving" @click="saveTemplate">
          <UIcon v-if="saving" name="i-lucide-loader" class="w-3.5 h-3.5 animate-spin mr-1" />
          {{ saving ? '保存中...' : '保存配置' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ═══════════ 容器：宽布局时双栏（配置源 + 时间轴） ═══════════ */
.timer-config {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

/* ═══════════ 环节类型选择器：左侧配置源 ═══════════ */
.config-source {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 16px;
  background-color: #ffffff;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  position: sticky;
  top: 16px;
}

/* 分组标题：18px Bold #000000 */
.section-header {
  font-size: 18px;
  font-weight: 700;
  line-height: 24px;
  color: #000000;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
}

.section-icon {
  margin-right: 6px;
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* 列表项容器：组内间距 8px */
.action-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 4px;
}

/* 列表项按钮：48px 高，8px 圆角，#E0E0E0 边框 */
.action-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 48px;
  padding: 0 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background-color: #ffffff;
  transition: background-color 0.2s ease;
  cursor: pointer;
}

.action-row:hover {
  background-color: #f5f5f5;
}

.action-row:active {
  transform: scale(0.98);
}

/* 文本标签：16px #000000 */
.action-label {
  font-size: 16px;
  color: #000000;
}

/* + 图标：20px #333333 */
.action-plus {
  font-size: 20px;
  line-height: 1;
  color: #333333;
  font-weight: 300;
}

/* → 箭头 */
.action-arrow {
  font-size: 16px;
  line-height: 1;
  color: #9ca3af;
}

/* ═══════════ 时间轴区块：右侧占据剩余空间 ═══════════ */
.timeline-section {
  flex: 1;
  min-width: 0;
  padding: 0;
}

.use-preset-btn {
  width: 100%;
  height: 40px;
  border: 1px dashed #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  color: #9ca3af;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 16px;
}

.use-preset-btn:hover {
  border-color: #10b981;
  color: #10b981;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 48px 0;
  font-size: 14px;
  color: #9ca3af;
}

/* ═══════════ 环节卡片 ═══════════ */
.phase-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 12px;
  transition: box-shadow 0.2s;
}

.phase-card--expanded {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* 卡片头 */
.phase-card-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.phase-card-header:hover {
  background-color: #f9fafb;
}

.phase-card-header--active {
  background-color: #f9fafb;
}

.sort-btns {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-right: 12px;
  color: #d1d5db;
}

.sort-btn {
  line-height: 1;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  color: #d1d5db;
  font-size: 10px;
}

.sort-btn:hover {
  color: #6b7280;
}

.phase-index {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 14px;
  flex-shrink: 0;
  margin-right: 12px;
}

.phase-type-tag {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  color: white;
  flex-shrink: 0;
  margin-right: 12px;
}

.phase-name {
  font-size: 16px;
  font-weight: 500;
  color: #1f2937;
  flex: 1;
}

.phase-duration {
  font-size: 14px;
  color: #6b7280;
  background: #f3f4f6;
  border-radius: 4px;
  padding: 2px 8px;
  margin-right: 12px;
}

.chevron-icon {
  width: 16px;
  height: 16px;
  color: #9ca3af;
  transition: transform 0.2s;
  flex-shrink: 0;
}

.rotate-180 {
  transform: rotate(180deg);
}

/* ═══════════ 卡片体（展开表单）═══════════ */
.phase-card-body {
  padding: 0 16px 16px;
  border-top: 1px solid #f3f4f6;
}

.form-grid {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-field {
  display: flex;
  flex-direction: column;
}

.form-label {
  font-size: 14px;
  color: #374151;
  margin-bottom: 6px;
}

.form-input {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  font-size: 14px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  outline: none;
  transition: border-color 0.2s;
}

.form-input:focus {
  border-color: #10b981;
}

.form-input--error {
  border-color: #ef4444;
}

.form-select {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  font-size: 14px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: white;
  outline: none;
  cursor: pointer;
}

.form-select:focus {
  border-color: #10b981;
}

.form-hint {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 4px;
}

.form-row-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.input-with-unit {
  display: flex;
}

.input-with-unit .form-input {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.input-unit {
  height: 40px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  font-size: 14px;
  color: #6b7280;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-left: none;
  border-top-right-radius: 4px;
  border-bottom-right-radius: 4px;
}

/* 级联选择器 */
.cascader-wrap {
  position: relative;
}

.cascader-trigger {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  font-size: 14px;
  text-align: left;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: border-color 0.2s;
}

.cascader-trigger:hover {
  border-color: #10b981;
}

.cascader-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 4px;
  z-index: 20;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  display: flex;
  min-width: 280px;
}

.cascader-left {
  width: 120px;
  border-right: 1px solid #f3f4f6;
  padding: 4px 0;
}

.cascader-cat {
  padding: 8px 12px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #374151;
}

.cascader-cat:hover {
  background-color: #f9fafb;
}

.cascader-cat--active {
  color: #10b981;
  background-color: #ecfdf5;
}

.cascader-right {
  flex: 1;
  padding: 4px 0;
}

.cascader-placeholder {
  padding: 8px 12px;
  font-size: 14px;
  color: #9ca3af;
}

.cascader-item {
  padding: 8px 12px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
  color: #374151;
}

.cascader-item:hover {
  background-color: #f9fafb;
}

.cascader-item--active {
  color: #10b981;
  background-color: #ecfdf5;
}

.cascader-desc {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 2px;
}

/* 奇袭开关 */
.surprise-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.surprise-title {
  font-size: 14px;
  color: #374151;
}

.surprise-desc {
  font-size: 12px;
  color: #9ca3af;
}

.toggle-switch {
  width: 44px;
  height: 24px;
  border-radius: 12px;
  background-color: #d1d5db;
  border: none;
  cursor: pointer;
  position: relative;
  transition: background-color 0.2s;
}

.toggle-switch--on {
  background-color: #10b981;
}

.toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: white;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
  transition: transform 0.2s;
}

.toggle-switch--on .toggle-knob {
  transform: translateX(20px);
}

/* 卡片底部操作栏 */
.card-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid #f3f4f6;
}

.footer-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: #9ca3af;
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.15s;
}

.footer-btn:hover {
  color: #6b7280;
}

.footer-btn--danger:hover {
  color: #ef4444;
}

.footer-btn--outline {
  padding: 6px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  color: #6b7280;
  background: white;
}

.footer-btn--outline:hover {
  background: #f9fafb;
}

/* ═══════════ 底部操作 ═══════════ */
.bottom-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 8px;
}

.add-more-btn {
  flex: 1;
  height: 40px;
  border: 1px dashed #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  color: #9ca3af;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.add-more-btn:hover {
  border-color: #10b981;
  color: #10b981;
}

.save-btn {
  padding: 0 24px;
  height: 40px;
  border-radius: 6px;
  font-size: 14px;
  color: white;
  font-weight: 500;
  background-color: #10b981;
  border: none;
  cursor: pointer;
  transition: background-color 0.2s;
  white-space: nowrap;
}

.save-btn:hover:not(:disabled) {
  background-color: #059669;
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
