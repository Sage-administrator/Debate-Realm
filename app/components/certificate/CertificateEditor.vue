<!--
  CertificateEditor.vue — 证书编辑面板（玻璃拟态，跟随主题）
  - 模板选择 / 画布尺寸 / 字段编辑 / 样式控制 / 从赛事数据填充
  - config 为响应式对象（与纸张共用同一数据源），直接双向绑定
-->
<template>
  <div class="cert-editor">
    <!-- 从赛事数据填充 -->
    <section class="cz-section">
      <div class="cz-card-title">从赛事数据填充</div>
      <USelect
        v-model="fillValue"
        :items="fillItems"
        placeholder="选择获得者（冠军/最佳辩手…）"
        class="w-full"
        :ui="{ base: 'input-glass' }"
      />
      <p class="cz-hint">自动写入获得者姓名与颁奖词（赛事名/主办方已预填）。</p>
    </section>

    <!-- 模板 -->
    <section class="cz-section">
      <div class="cz-card-title">证书模板</div>
      <div class="cz-tpl-grid">
        <button
          v-for="t in TEMPLATES"
          :key="t.key"
          class="cz-tpl"
          :class="{ active: config.template === t.key }"
          @click="$emit('apply-template', t.key)"
        >
          <span class="cz-tpl-label">{{ t.label }}</span>
          <span class="cz-tpl-desc">{{ t.description }}</span>
        </button>
      </div>
    </section>

    <!-- 画布尺寸 -->
    <section class="cz-section">
      <div class="cz-card-title">画布尺寸（制作大小）</div>
      <div class="cz-seg">
        <button
          v-for="s in SIZE_PRESET_LIST"
          :key="s.key"
          class="cz-seg-btn"
          :class="{ active: config.size === s.key }"
          @click="config.size = s.key"
        >
          {{ s.label }}
        </button>
      </div>
      <p class="cz-hint">设计基准 150 DPI，导出可选 300 DPI 高清。</p>
    </section>

    <!-- 内容字段 -->
    <section class="cz-section">
      <div class="cz-card-title">内容</div>

      <label class="cz-label">证书标题</label>
      <UInput
        v-model="config.title"
        placeholder="荣誉证书"
        class="w-full"
        :ui="{ base: 'input-glass' }"
      />

      <label class="cz-label">证书编号</label>
      <UInput
        v-model="config.certNo"
        placeholder="如 2024-001"
        class="w-full"
        :ui="{ base: 'input-glass' }"
      />

      <label class="cz-label">获得者类型</label>
      <div class="cz-seg">
        <button
          class="cz-seg-btn"
          :class="{ active: config.recipientType === 'team' }"
          @click="config.recipientType = 'team'"
        >
          队伍
        </button>
        <button
          class="cz-seg-btn"
          :class="{ active: config.recipientType === 'person' }"
          @click="config.recipientType = 'person'"
        >
          个人
        </button>
      </div>

      <label class="cz-label">获得者姓名</label>
      <UInput
        v-model="config.recipientName"
        placeholder="获得者姓名"
        class="w-full"
        :ui="{ base: 'input-glass' }"
      />

      <template v-if="config.recipientType === 'team'">
        <label class="cz-label">队徽图片 URL（可选）</label>
        <UInput
          v-model="config.recipientLogo"
          placeholder="https://… 或 /uploads/…"
          class="w-full"
          :ui="{ base: 'input-glass' }"
        />
      </template>

      <label class="cz-label">赛事名称</label>
      <UInput
        v-model="config.tournamentName"
        placeholder="赛事名称"
        class="w-full"
        :ui="{ base: 'input-glass' }"
      />

      <label class="cz-label">颁奖词 / 事由</label>
      <UTextarea
        v-model="config.awardText"
        :rows="3"
        placeholder="填写颁奖词…"
        class="w-full"
        :ui="{ base: 'input-glass' }"
      />

      <div class="cz-row">
        <div class="flex-1">
          <label class="cz-label">颁发日期</label>
          <BaseDateTimePicker v-model="config.date" mode="date" placeholder="选择颁发日期" />
        </div>
      </div>

      <label class="cz-label">落款 / 主办方</label>
      <UInput
        v-model="config.issuer"
        placeholder="主办方名称"
        class="w-full"
        :ui="{ base: 'input-glass' }"
      />
    </section>

    <!-- 样式 -->
    <section class="cz-section">
      <div class="cz-card-title">纸张样式</div>

      <label class="cz-label">配色主题</label>
      <div class="cz-swatches">
        <button
          v-for="t in THEME_LIST"
          :key="t.key"
          class="cz-swatch"
          :class="{ active: config.style.theme === t.key }"
          :style="{ background: t.swatch }"
          :title="t.label"
          @click="config.style.theme = t.key"
        >
          <span v-if="config.style.theme === t.key" class="cz-swatch-check">✓</span>
        </button>
      </div>

      <label class="cz-label">边框</label>
      <div class="cz-seg">
        <button
          v-for="b in BORDER_LIST"
          :key="b.key"
          class="cz-seg-btn"
          :class="{ active: config.style.border === b.key }"
          @click="config.style.border = b.key"
        >
          {{ b.label }}
        </button>
      </div>

      <label class="cz-label">字体</label>
      <div class="cz-seg">
        <button
          v-for="f in FONT_LIST"
          :key="f.key"
          class="cz-seg-btn"
          :class="{ active: config.style.font === f.key }"
          @click="config.style.font = f.key"
        >
          {{ f.label }}
        </button>
      </div>

      <template v-if="config.style.theme === 'custom'">
        <label class="cz-label">自定义背景</label>
        <UInput
          v-model="config.style.bg"
          placeholder="#ffffff 或 linear-gradient(…)"
          class="w-full"
          :ui="{ base: 'input-glass' }"
        />
      </template>

      <label class="cz-label">印章</label>
      <div class="cz-seg">
        <button
          class="cz-seg-btn"
          :class="{ active: config.style.seal }"
          @click="config.style.seal = true"
        >
          显示
        </button>
        <button
          class="cz-seg-btn"
          :class="{ active: !config.style.seal }"
          @click="config.style.seal = false"
        >
          隐藏
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  type CertificateConfig,
  type FillKind,
  TEMPLATES,
  SIZE_PRESET_LIST,
  THEME_LIST,
  BORDER_LIST,
  FONT_LIST,
  fillOptionsFromData,
} from '~/utils/certificateTemplates'

const props = defineProps<{
  config: CertificateConfig
  standings?: any[]
  bestDebaters?: any[]
}>()

const emit = defineEmits<{
  'apply-template': [key: string]
  fill: [kind: FillKind]
}>()

const fillValue = ref<FillKind | undefined>(undefined)
const fillItems = computed(() =>
  fillOptionsFromData(props.standings || [], props.bestDebaters || []),
)

watch(fillValue, (v) => {
  if (v) {
    emit('fill', v as FillKind)
    fillValue.value = undefined
  }
})
</script>

<style scoped>
.cert-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
}
/* 分区：与画布共享同一面板底色，仅用细分隔线区隔，构成一体化工作台 */
.cz-section {
  padding: 14px 16px;
  border-top: 1px solid var(--color-border);
}
.cz-section:first-child {
  border-top: none;
}
.cz-card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 10px;
}
.cz-hint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.5;
}
.cz-label {
  display: block;
  margin: 12px 0 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
}
.cz-label:first-child {
  margin-top: 0;
}
.cz-row {
  margin-top: 12px;
}

/* 模板卡片 */
.cz-tpl-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.cz-tpl {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-tertiary);
  text-align: left;
  cursor: pointer;
  transition: all 0.18s ease;
}
.cz-tpl:hover {
  border-color: var(--color-accent-primary);
  transform: translateY(-1px);
}
.cz-tpl.active {
  border-color: var(--color-accent-primary);
  background: var(--color-accent-bg);
}
.cz-tpl-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}
.cz-tpl-desc {
  font-size: 11px;
  color: var(--color-text-muted);
}

/* 分段按钮 */
.cz-seg {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.cz-seg-btn {
  flex: 1;
  min-width: 64px;
  padding: 8px 10px;
  border-radius: 9px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.18s ease;
  white-space: nowrap;
}
.cz-seg-btn:hover {
  color: var(--color-text-primary);
  border-color: var(--color-accent-primary);
}
.cz-seg-btn.active {
  background: var(--color-accent-bg);
  color: var(--color-accent-primary);
  border-color: var(--color-accent-primary);
  font-weight: 600;
}

/* 配色色板 */
.cz-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.cz-swatch {
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.18s ease;
}
.cz-swatch:hover {
  transform: scale(1.06);
}
.cz-swatch.active {
  border-color: var(--color-text-primary);
  box-shadow:
    0 0 0 2px var(--color-bg-secondary),
    0 0 0 4px var(--color-accent-primary);
}
.cz-swatch-check {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
}
</style>
