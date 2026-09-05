<script setup lang="ts">
// 创建赛事页面 - 精简版（按用户需求移除高校/企业/其他、具体主办、参赛队伍、比赛地点、评委）
import { cityData } from '~~/app/data/cities'
import type { CityGroup } from '~~/app/data/cities'

const store = useAuthStore()
const toast = useToast()
const { createTournament } = useTournament()

const teamId = computed(() => store.user?.team?.id)

// ── 表单数据 ──
const form = reactive({
  // 赛事名称
  name: '',
  // 赛事地区 - 省市二级级联
  regionProvince: '',
  regionCity: '',
  // 举办周期 - MonthRangePicker
  startDate: '',
  endDate: '',
  // 主办方类别：仅保留 中小学 / 社会组织
  organizerCategory: '',
  // 赛事主办方
  organizer: '',
  // 协议确认
  agreedToTerms: false,
})

const loading = ref(false)

// ── 表单错误（统一在组件下方显示红色小字，不再使用 toast 警告） ──
const errors = reactive<{ [k: string]: string }>({
  name: '',
  period: '',
  region: '',
  organizerCategory: '',
  organizer: '',
  agreedToTerms: '',
})

// 统一清除某字段错误
function clearError(key: string) {
  if (errors[key]) errors[key] = ''
}

// 赛事名称：不能为空 + 长度不少于5个字
function validateName() {
  const v = form.name.trim()
  if (!v) errors.name = '请输入赛事名称'
  else if (v.length < 5) errors.name = '赛事名称不少于5个字'
  else errors.name = ''
}

// 举办周期
function validatePeriod() {
  if (!form.startDate || !form.endDate) errors.period = '请选择举办周期'
  else errors.period = ''
}

// 赛事地区
function validateRegion() {
  if (!form.regionProvince) {
    errors.region = '请选择赛事地区'
    return
  }
  const group = cityData.find((g: CityGroup) => g.province === form.regionProvince)
  const hasCities = !!(group?.cities && group.cities.length > 0)
  // 有二级城市的省份必须选到城市；无二级的（线上、直辖市）有省份即可
  if (hasCities && !form.regionCity) {
    errors.region = '请选择城市'
  } else {
    errors.region = ''
  }
}

// 主办方类别
function validateOrganizerCategory() {
  if (!form.organizerCategory) errors.organizerCategory = '请选择主办方类别'
  else errors.organizerCategory = ''
}

// 赛事主办方：不能为空 + 长度不少于5个字
function validateOrganizer() {
  const v = form.organizer.trim()
  if (!v) errors.organizer = '请输入赛事主办方'
  else if (v.length < 5) errors.organizer = '赛事主办方不少于5个字'
  else errors.organizer = ''
}

// 服务协议
function validateAgreedToTerms() {
  if (!form.agreedToTerms) errors.agreedToTerms = '请先阅读并同意服务协议'
  else errors.agreedToTerms = ''
}

// 全量校验：提交时调用，任何字段有错误都不提交
function validateForm(): boolean {
  validateName()
  validatePeriod()
  validateRegion()
  validateOrganizerCategory()
  validateOrganizer()
  validateAgreedToTerms()
  return !(
    errors.name ||
    errors.period ||
    errors.region ||
    errors.organizerCategory ||
    errors.organizer ||
    errors.agreedToTerms
  )
}

// ── 城市级联数据 ──
// 根据选中的省份，获取对应的城市列表
const currentCities = computed(() => {
  if (!form.regionProvince) return []
  const group = cityData.find((g: CityGroup) => g.province === form.regionProvince)
  return group?.cities ?? []
})

// 省份变更时重置城市选择
watch(
  () => form.regionProvince,
  () => {
    form.regionCity = ''
  },
)

// ── 主办方类别（仅保留中小学与社会组织） ──
const organizerCategoryOptions = [
  { label: '中小学', value: '中小学' },
  { label: '社会组织', value: '社会组织' },
]

// ── 表单提交 ──
async function handleCreate() {
  // 全量校验：任何字段不通过都不会提交（所有提示都直接显示在对应控件下方）
  if (!validateForm()) return

  loading.value = true
  try {
    // 将 UI 字段拼接进 description
    const extendedInfo: string[] = []
    if (form.regionProvince && form.regionCity) {
      extendedInfo.push(`地区：${form.regionProvince} ${form.regionCity}`)
    }
    if (form.organizerCategory) extendedInfo.push(`主办方类别：${form.organizerCategory}`)
    if (form.startDate && form.endDate)
      extendedInfo.push(`举办周期：${form.startDate} 至 ${form.endDate}`)
    const description = extendedInfo.join('；')

    const result = await createTournament(teamId.value!, {
      name: form.name.trim(),
      description,
      scheduledAt: form.startDate ? `${form.startDate}-01` : undefined,
    })

    toast.add({ title: '赛事创建成功', color: 'success' })
    await navigateTo(`/tournaments/${(result as any).id}/info`)
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage || e?.statusMessage || '创建失败', color: 'error' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <!-- 外层容器：不额外设置背景（body 已有深色渐变），渐入动画 -->
  <div class="min-h-screen p-8 fade-in">
    <div class="max-w-3xl mx-auto">
      <!-- 页面标题区 -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-[var(--color-text-primary)] mb-2">创建赛事</h1>
        <p class="text-[var(--color-text-secondary)] text-sm">
          快速开始创建赛事，填写以下信息完成创建
        </p>
      </div>

      <!-- 主表单卡片：深色玻璃拟态风格 -->
      <div class="glass-card-strong p-6 sm:p-8">
        <div class="space-y-6">
          <!-- 1. 赛事名称 -->
          <div>
            <label class="block text-[var(--color-text-secondary)] text-sm font-medium mb-1.5">
              赛事名称 <span class="text-red-500 dark:text-red-400">*</span>
            </label>
            <input
              v-model="form.name"
              type="text"
              placeholder="请输入赛事名称"
              class="input-glass w-full h-10"
              :class="errors.name ? '!border-red-400 focus:!border-red-400' : ''"
              @input="validateName"
              @blur="validateName"
            />
            <p v-if="errors.name" class="text-red-500 dark:text-red-400 text-xs mt-1.5">
              {{ errors.name }}
            </p>
            <p v-else class="text-[var(--color-text-muted)] text-xs mt-1.5">
              请不要在这里填写辩题，辩题将在赛事详情中设置
            </p>
          </div>

          <!-- 2. 举办周期（月范围） + 3. 赛事地区（级联选择） 同一行 -->
          <div class="grid grid-cols-2 gap-4">
            <!-- 左：举办周期 - MonthRangePicker（自定义组件保持原样） -->
            <div>
              <label class="block text-[var(--color-text-secondary)] text-sm font-medium mb-1.5">
                举办周期 <span class="text-red-500 dark:text-red-400">*</span>
              </label>
              <div
                class="period-wrapper"
                :class="errors.period ? 'ring-1 ring-red-400 rounded' : ''"
              >
                <MonthRangePicker
                  :start-date="form.startDate"
                  :end-date="form.endDate"
                  @update:start-date="
                    form.startDate = $event
                    clearError('period')
                  "
                  @update:end-date="
                    form.endDate = $event
                    clearError('period')
                  "
                />
              </div>
              <p v-if="errors.period" class="text-red-500 dark:text-red-400 text-xs mt-1.5">
                {{ errors.period }}
              </p>
            </div>

            <!-- 右：赛事地区 - 省市二级级联（自定义组件保持原样） -->
            <div>
              <label class="block text-[var(--color-text-secondary)] text-sm font-medium mb-1.5">
                赛事地区 <span class="text-red-500 dark:text-red-400">*</span>
              </label>
              <RegionCascader
                :province="form.regionProvince"
                :city="form.regionCity"
                @update:province="
                  form.regionProvince = $event
                  clearError('region')
                "
                @update:city="
                  form.regionCity = $event
                  clearError('region')
                "
              />
              <p v-if="errors.region" class="text-red-500 dark:text-red-400 text-xs mt-1.5">
                {{ errors.region }}
              </p>
            </div>
          </div>

          <!-- 4-5. 主办方类别 + 赛事主办方（两列并排，比例 1 : 3） -->
          <div class="grid gap-4 two-col-form">
            <!-- 4. 主办方类别 - Segmented Control（深色风格） -->
            <div class="col-category">
              <label class="block text-[var(--color-text-secondary)] text-sm font-medium mb-1.5">
                主办方类别 <span class="text-red-500 dark:text-red-400">*</span>
              </label>
              <div
                class="flex bg-[var(--color-bg-tertiary)] rounded-lg p-0.5 gap-0.5 h-10"
                :class="errors.organizerCategory ? 'ring-1 ring-red-400' : ''"
              >
                <button
                  v-for="cat in organizerCategoryOptions"
                  :key="cat.value"
                  type="button"
                  class="flex-1 px-3 text-sm rounded-md transition-all cursor-pointer flex items-center justify-center"
                  :class="
                    form.organizerCategory === cat.value
                      ? 'bg-indigo-500/30 text-[var(--color-text-primary)] font-medium'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                  "
                  @click="
                    () => {
                      form.organizerCategory = cat.value
                      clearError('organizerCategory')
                    }
                  "
                >
                  {{ cat.label }}
                </button>
              </div>
              <p
                v-if="errors.organizerCategory"
                class="text-red-500 dark:text-red-400 text-xs mt-1.5"
              >
                {{ errors.organizerCategory }}
              </p>
            </div>

            <!-- 5. 赛事主办方（加宽列宽） -->
            <div class="col-organizer">
              <label class="block text-[var(--color-text-secondary)] text-sm font-medium mb-1.5">
                赛事主办方 <span class="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                v-model="form.organizer"
                type="text"
                placeholder="请输入主办单位名称"
                class="input-glass w-full h-10"
                :class="errors.organizer ? '!border-red-400 focus:!border-red-400' : ''"
                @input="validateOrganizer"
                @blur="validateOrganizer"
              />
              <p v-if="errors.organizer" class="text-red-500 dark:text-red-400 text-xs mt-1.5">
                {{ errors.organizer }}
              </p>
            </div>
          </div>

          <!-- 底部：协议 + 提交 -->
          <div class="pt-2 space-y-4">
            <!-- 协议勾选（深色风格） -->
            <label class="inline-flex items-start gap-2 cursor-pointer group">
              <span
                class="relative flex items-center justify-center w-4 h-4 mt-0.5 shrink-0"
                @click="clearError('agreedToTerms')"
              >
                <!-- 深色风格复选框：未选中为白色半透明边框，选中为紫色 -->
                <span
                  class="absolute inset-0 rounded-sm border transition-colors"
                  :class="
                    form.agreedToTerms
                      ? 'bg-indigo-500 border-indigo-500'
                      : errors.agreedToTerms
                        ? 'border-red-400'
                        : 'border-[var(--color-border)] group-hover:border-white/40'
                  "
                />
                <UIcon
                  v-if="form.agreedToTerms"
                  name="i-lucide-check"
                  class="relative w-3 h-3 text-white"
                />
              </span>
              <input
                type="checkbox"
                v-model="form.agreedToTerms"
                class="sr-only"
                @change="clearError('agreedToTerms')"
              />
              <span class="text-[var(--color-text-muted)] text-xs leading-relaxed">
                创建赛事即代表您已同意
                <span class="text-indigo-600 dark:text-indigo-400 cursor-pointer hover:underline"
                  >服务协议</span
                >
                和
                <span class="text-indigo-600 dark:text-indigo-400 cursor-pointer hover:underline"
                  >隐私政策</span
                >
              </span>
            </label>
            <p v-if="errors.agreedToTerms" class="text-red-500 dark:text-red-400 text-xs">
              {{ errors.agreedToTerms }}
            </p>

            <!-- 提交按钮：渐变紫色主按钮 -->
            <button
              type="button"
              class="btn-primary w-full py-3 text-base font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="loading"
              @click="handleCreate"
            >
              <UIcon v-if="loading" name="i-lucide-loader" class="w-4 h-4 animate-spin" />
              <UIcon v-else name="i-lucide-plus" class="w-4 h-4" />
              {{ loading ? '创建中...' : '创建赛事' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 地区级联选择器：填满列宽 */
.region-cascader,
.region-cascader :deep(.cascader-trigger) {
  width: 100%;
}

/* 举办周期：组件自身已改为 width:100%，这里仅保留微调入口 */
.period-wrapper {
  width: 100%;
}

/* 主办方类别 + 赛事主办方 两列比例：1 : 3
   - 主办方类别 较窄（仅两个按钮）
   - 赛事主办方 input 加宽（需要容纳较长文字）
*/
.two-col-form {
  display: grid;
  grid-template-columns: 1fr 3fr;
  column-gap: 1rem;
}

/* 主办方类别 segmented control：让按钮填满高度并与 h-10 的 input/select 对齐 */
.two-col-form :deep(.col-category) > div:last-child {
  width: 100%;
}
</style>
