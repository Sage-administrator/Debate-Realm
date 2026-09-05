<script setup lang="ts">
// 辩题库选择器：在辩题投票编辑器中拉取辩题到候选列表
// 展示赛事辩题库条目（正方/反方），点击"加入"将结构化辩题 emit 给父组件
const props = defineProps<{
  open: boolean
  tournamentId: string
  /** 当前问卷候选列表，用于标记已在候选中的辩题 */
  candidates?: any[]
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'select', topic: any): void
}>()

const toast = useToast()
const { listTopics } = useDebateTopic()

const topics = ref<any[]>([])
const loading = ref(false)
const search = ref('')
const category = ref('all')

// 从已加载条目派生分类列表
const categories = computed(() => {
  const set = new Set<string>()
  for (const t of topics.value) {
    if (t.category) set.add(t.category)
  }
  return Array.from(set)
})

// 已加入候选的判定：来源ID 相同或 正/反 立场文本相同
function keyOf(t: any): string {
  const aff = (t?.affirmative || '').toString().trim().toLowerCase()
  const neg = (t?.negative || '').toString().trim().toLowerCase()
  return `${aff}|||${neg}`
}
const addedKeys = computed(() => {
  const set = new Set<string>()
  for (const c of props.candidates || []) {
    if (c?.sourceTopicId) set.add('src:' + c.sourceTopicId)
    set.add(keyOf(c))
  }
  return set
})
function isAdded(t: any): boolean {
  if (t?.id && addedKeys.value.has('src:' + t.id)) return true
  return addedKeys.value.has(keyOf(t))
}

async function load() {
  loading.value = true
  try {
    const res = await listTopics(props.tournamentId, {
      search: search.value.trim() || undefined,
      category: category.value !== 'all' ? category.value : undefined,
    })
    topics.value = res.topics || []
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || '加载辩题库失败', color: 'error' })
  } finally {
    loading.value = false
  }
}

// 打开时加载；搜索/分类变化时重新加载
watch(
  () => props.open,
  (v) => {
    if (v) load()
  },
)
watch([search, category], () => {
  if (props.open) load()
})

function handleSelect(t: any) {
  if (isAdded(t)) {
    toast.add({ title: '该辩题已在候选列表中', color: 'warning' })
    return
  }
  emit('select', t)
}

// 一键加入当前筛选下的全部辩题
function addAll() {
  let n = 0
  for (const t of topics.value) {
    if (!isAdded(t)) {
      emit('select', t)
      n++
    }
  }
  if (n > 0) {
    toast.add({ title: `已加入 ${n} 个辩题到候选`, color: 'success' })
    close()
  } else {
    toast.add({ title: '当前辩题已全部在候选列表中', color: 'warning' })
  }
}

function close() {
  emit('update:open', false)
}
</script>

<template>
  <UModal :open="open" @update:open="(v: boolean) => emit('update:open', v)">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-library" class="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        <span class="text-base font-semibold text-[var(--color-text-primary)]"
          >从辩题库拉取辩题</span
        >
      </div>
    </template>

    <template #body>
      <div class="p-5">
        <!-- 搜索 + 分类过滤 -->
        <div class="flex flex-wrap items-center gap-2 mb-4">
          <div class="flex-1 min-w-[180px]">
            <input
              v-model="search"
              type="text"
              placeholder="搜索正方 / 反方 / 备注"
              class="w-full fd-input"
            />
          </div>
          <ClientOnly>
            <USelect
              v-model="category"
              :items="[
                { label: '全部分类', value: 'all' },
                ...categories.map((c) => ({ label: c, value: c })),
              ]"
              class="w-36"
              :ui="{
                base: 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border-[var(--color-border)]',
              }"
            />
            <template #fallback>
              <div
                class="w-36 h-9 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
              />
            </template>
          </ClientOnly>
        </div>

        <!-- 列表 -->
        <div v-if="loading" class="flex justify-center py-10">
          <UIcon
            name="i-lucide-loader"
            class="w-6 h-6 animate-spin text-emerald-600 dark:text-emerald-400"
          />
        </div>
        <div v-else-if="topics.length === 0" class="text-center py-10">
          <UIcon
            name="i-lucide-inbox"
            class="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-2"
          />
          <p class="text-sm text-[var(--color-text-secondary)]">辩题库暂无条目</p>
          <p class="text-xs text-[var(--color-text-muted)] mt-1">
            请先切换到
            <NuxtLink
              :to="`/tournaments/${tournamentId}/topic-votes?tab=library`"
              class="text-emerald-600 dark:text-emerald-400 hover:underline"
              @click="close"
            >
              辩题库
            </NuxtLink>
            标签页添加辩题
          </p>
        </div>
        <div v-else class="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          <div
            v-for="t in topics"
            :key="t.id"
            class="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex-1 min-w-0">
                <div v-if="t.category || isAdded(t)" class="mb-1 flex items-center gap-1.5">
                  <span
                    v-if="t.category"
                    class="text-[11px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    >{{ t.category }}</span
                  >
                  <span
                    v-if="isAdded(t)"
                    class="text-[11px] px-1.5 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)]"
                    >已加入候选</span
                  >
                </div>
                <div class="flex items-start gap-2 text-sm">
                  <span class="side-badge side-badge-pro shrink-0">正方</span>
                  <span class="text-[var(--color-text-primary)] leading-relaxed">{{
                    t.affirmative
                  }}</span>
                </div>
                <div class="flex items-start gap-2 text-sm mt-1">
                  <span class="side-badge side-badge-con shrink-0">反方</span>
                  <span class="text-[var(--color-text-primary)] leading-relaxed">{{
                    t.negative
                  }}</span>
                </div>
                <p v-if="t.note" class="text-xs text-[var(--color-text-muted)] mt-1.5">
                  {{ t.note }}
                </p>
              </div>
              <UButton
                size="xs"
                :color="isAdded(t) ? 'neutral' : 'success'"
                :variant="isAdded(t) ? 'soft' : 'soft'"
                :disabled="isAdded(t)"
                icon="i-lucide-plus"
                @click="handleSelect(t)"
              >
                {{ isAdded(t) ? '已加入' : '加入' }}
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex items-center justify-between">
        <UButton
          color="success"
          variant="soft"
          icon="i-lucide-library-big"
          :disabled="topics.length === 0"
          @click="addAll"
        >
          加入全部（当前筛选）
        </UButton>
        <UButton color="neutral" variant="outline" @click="close">关闭</UButton>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.side-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  padding: 0.05rem 0.4rem;
  font-size: 0.7rem;
  font-weight: 600;
  border-radius: 0.3rem;
  line-height: 1.4;
}
.side-badge-pro {
  background: rgba(239, 68, 68, 0.15);
  color: #dc2626;
}
:global(.dark) .side-badge-pro {
  color: #f87171;
}
.side-badge-con {
  background: rgba(59, 130, 246, 0.15);
  color: #2563eb;
}
:global(.dark) .side-badge-con {
  color: #60a5fa;
}

.fd-input {
  width: 100%;
  padding: 0.375rem 0.625rem;
  font-size: 0.8125rem;
  color: var(--color-text-primary);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  outline: none;
  transition:
    border-color 0.15s,
    box-shadow 0.15s,
    background-color 0.15s;
}
.fd-input::placeholder {
  color: var(--color-text-muted);
}
.fd-input:focus {
  border-color: var(--color-accent-primary);
  background: var(--color-bg-tertiary);
  box-shadow: 0 0 0 2px var(--color-accent-bg);
}
</style>
