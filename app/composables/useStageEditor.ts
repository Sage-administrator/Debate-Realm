/**
 * useStageEditor —— 计时环节配置编辑器（跨宿主共享逻辑）
 *
 * 收敛 tournaments/[id]/timing 与 standalone/[id]/timing 两份几乎逐字相同的配置页逻辑：
 * 环节增删改、拖拽排序、模板套用、自动保存防抖、角色标题解析等。
 *
 * 宿主差异仅两点，通过 opts 注入：
 *   - hostType:  传给 useTimerConfig 的宿主类型（'tournament' | 'standalone'）
 *   - hostNameRef: 从父布局 inject 的赛事/单场 Ref，用于回填 config.name/title
 *
 * 注意：本组合式统一采用「归一化环节类型」判断（isDualTimer / isNoTimer / isPpt），
 * 取代 standalone 旧版使用的裸字符串 'special' / 'dual-timer'，
 * 从而修复 standalone 通过分类栏新增 no_timer 环节被错误设为 180 秒的问题。
 */
import { computed, ref, onMounted, watch } from 'vue'
import { useTimerConfig } from './useTimerConfig'
import { debateTemplates } from '~/data/debate-templates'
import { isDualTimer, isNoTimer, isPpt, isQuestion } from '~/utils/stageType'

export type StageEditorHost = 'tournament' | 'standalone'

export interface StageEditorOptions {
  hostType: StageEditorHost
  hostNameRef: Ref<any>
}

/** 与页面内 Stage 接口结构一致（仅作组合式内部类型约束，页面保留各自定义亦可） */
interface Stage {
  id: number | string
  name: string
  duration: number
  type: string
  description?: string
  order?: number
  orderIndex?: number
  positiveDuration?: number
  negativeDuration?: number
  speaker?: string
  speakerMode?: number
  questioner?: string
  questionerMode?: number
  responder?: string
  responders?: string[]
  respondersMode?: number
  firstSpeaker?: string
  protectionTime?: number
  positiveSpeakers?: string[]
  negativeSpeakers?: string[]
  questionDuration?: number
  answerDuration?: number
  speakers?: string[]
  pptImage?: string
}

export function useStageEditor(opts: StageEditorOptions) {
  const route = useRoute()
  const toast = useToast()
  const hostId = computed(() => route.params.id as string)

  const loading = ref(false)
  const saving = ref(false)
  const previewStageIndex = ref(0)
  const expandedId = ref<number | string | null>(null)
  const showTemplateModal = ref(false)

  // 拖拽排序状态
  const dragSourceId = ref<string | number | null>(null)
  const dragOverId = ref<string | number | null>(null)

  const { config, loadConfig, saveConfig } = useTimerConfig()

  function genTmpId(): string {
    return 'tmp_' + (crypto?.randomUUID?.() || Date.now() + '_' + Math.random().toString(36).slice(2))
  }

  // 分类栏数据
  const timerCountTypes = [
    { type: 'single_speech', name: '单计时器环节', label: '单计时器' },
    { type: 'bilateral_debate', name: '双计时器环节', label: '双计时器' },
    { type: 'no_timer', name: '无计时器环节', label: '无计时器' },
  ]
  const speechTypes = [
    { name: '立论' },
    { name: '驳论' },
    { name: '小结' },
    { name: '总结陈词' },
  ]
  const questionTypes = [
    { name: '质询' },
    { name: '盘问' },
  ]
  const dualTypes = [
    { name: '对辩' },
    { name: '自由辩论' },
  ]

  /** 获取环节对应的角色信息（用于卡片头标题显示） */
  function getStageSpeaker(stage: any): string {
    const t = stage.type
    const speaker = stage.speaker
    const questioner = stage.questioner
    const responder = stage.responder
    const responders = stage.responders
    const first = stage.firstSpeaker

    if (t === 'single_speech' || t === 'speech' || t === 'question' || t === 'summary') {
      return (speaker || '正方·一辩').replace(/[·\/\s\-]/g, '')
    }
    if (t === 'single_question') {
      const strip = (s: string) => (s || '').replace(/[·\/\s\-]/g, '')
      const q = strip(questioner || '反方·二辩')
      const rList = responders && responders.length
        ? responders.map((r: string) => strip(r))
        : [strip(responder || '正方·一辩')]
      return `${q} · ${stage.name || ''} · ${rList.join('、')}`
    }
    if (isDualTimer(t)) {
      return (first || '正方·一辩').replace(/[·\/\s\-]/g, '')
    }
    if (t === 'no_timer') {
      const speakers: string[] = Array.isArray(stage.speakers)
        ? stage.speakers
        : (typeof stage.speakers === 'string' && stage.speakers ? JSON.parse(stage.speakers) : [])
      return speakers.length ? speakers.join('、') : ''
    }
    return ''
  }

  // 初始加载完成标记 —— 防止加载过程误触发自动保存 PUT
  let initialLoadDone = false
  // 配置变化时防抖保存的定时器句柄
  let saveTimeout: ReturnType<typeof setTimeout> | null = null

  async function loadPageConfig() {
    loading.value = true
    try {
      if (opts.hostNameRef.value) {
        config.value.name = opts.hostNameRef.value.name
        config.value.title = opts.hostNameRef.value.name
      }
      await loadConfig(hostId.value, opts.hostType)
      if ((config.value.stages as Stage[]).length === 0) {
        config.value.stages = getDefaultStages()
      }
    } catch (e: any) {
      toast.add({ title: e?.data?.statusMessage || '加载失败', color: 'error' })
    } finally {
      initialLoadDone = true
      loading.value = false
      if (saveTimeout) {
        clearTimeout(saveTimeout)
        saveTimeout = null
      }
    }
  }

  function getDefaultStages(): Stage[] {
    return [
      { id: 1, name: '开篇立论', duration: 180, type: 'single_speech', order: 1 },
      { id: 2, name: '攻辩', duration: 120, type: 'single_speech', order: 2 },
      { id: 3, name: '自由辩论', duration: 240, type: 'free_debate', order: 3, positiveDuration: 120, negativeDuration: 120 },
      { id: 4, name: '总结陈词', duration: 180, type: 'single_speech', order: 4 },
    ]
  }

  async function savePageConfig() {
    if (!initialLoadDone) return
    if (saving.value) return
    saving.value = true
    try {
      await saveConfig(hostId.value, opts.hostType)
    } catch (e: any) {
      toast.add({ title: e?.data?.statusMessage || '保存失败', color: 'error' })
    } finally {
      saving.value = false
    }
  }

  function addStageByType(type: string, name: string) {
    const newStage: Stage = {
      id: genTmpId(),
      name,
      duration: (isNoTimer(type) || isPpt(type)) ? 0 : 180,
      type: type as Stage['type'],
      orderIndex: (config.value.stages as Stage[]).length + 1,
      description: '',
    }
    if (isDualTimer(type)) {
      newStage.positiveDuration = 120
      newStage.negativeDuration = 120
    }
    ;(config.value.stages as Stage[]).push(newStage)
    expandedId.value = newStage.id
    stageChangeCounter.value++
  }

  function removeStage(idx: number) {
    const stages = config.value.stages as Stage[]
    if (stages.length <= 1) {
      toast.add({ title: '至少保留一个环节', color: 'info' })
      return
    }
    const removed = stages[idx]
    stages.splice(idx, 1)
    if (expandedId.value === removed?.id) expandedId.value = null
    stageChangeCounter.value++
  }

  function duplicateStage(idx: number) {
    const stages = config.value.stages as Stage[]
    const original = stages[idx]
    if (!original) return
    const copy: Stage = {
      ...structuredClone(original),
      id: genTmpId(),
      name: original.name + ' (副本)',
      orderIndex: stages.length + 1,
    }
    stages.splice(idx + 1, 0, copy)
    expandedId.value = copy.id
    stageChangeCounter.value++
  }

  function onDragStart(e: DragEvent, id: string | number) {
    dragSourceId.value = id
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', String(id))
    }
  }

  function onDragOver(e: DragEvent, id: string | number) {
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
    if (dragOverId.value !== id) dragOverId.value = id
  }

  function onDragLeave(id: string | number) {
    if (dragOverId.value === id) dragOverId.value = null
  }

  function onDrop(targetId: string | number) {
    if (dragSourceId.value === null || dragSourceId.value === targetId) return
    const stages = config.value.stages as Stage[]
    const sourceIdx = stages.findIndex(s => s.id === dragSourceId.value)
    const targetIdx = stages.findIndex(s => s.id === targetId)
    if (sourceIdx < 0 || targetIdx < 0) return
    const [item] = stages.splice(sourceIdx, 1)
    if (item) stages.splice(targetIdx, 0, item)
    dragOverId.value = null
    stageChangeCounter.value++
  }

  function onDragEnd() {
    dragSourceId.value = null
    dragOverId.value = null
  }

  function toggleExpand(id: number | string) {
    expandedId.value = expandedId.value === id ? null : id
  }

  function onStageFormUpdate(stage: Stage, formData: {
    type: string
    name: string
    duration: number
    protectionTime: number
    speaker?: string
    questioner?: string
    responders?: string[]
    firstSpeaker?: string
    positiveSpeakers?: string[]
    negativeSpeakers?: string[]
    questionDuration?: number
    answerDuration?: number
    speakers?: string[]
    pptImage?: string
    speakerMode?: number
    questionerMode?: number
    respondersMode?: number
  }) {
    stage.type = formData.type
    stage.name = formData.name
    stage.protectionTime = formData.protectionTime
    stage.speaker = formData.speaker
    stage.speakerMode = formData.speakerMode
    stage.questioner = formData.questioner
    stage.questionerMode = formData.questionerMode
    stage.responders = formData.responders
    stage.respondersMode = formData.respondersMode
    stage.firstSpeaker = formData.firstSpeaker
    stage.positiveSpeakers = formData.positiveSpeakers
    stage.negativeSpeakers = formData.negativeSpeakers
    stage.questionDuration = formData.questionDuration
    stage.answerDuration = formData.answerDuration
    stage.pptImage = formData.pptImage || ''
    stage.speakers = formData.speakers

    const t = formData.type
    if (isDualTimer(t)) {
      stage.positiveDuration = formData.duration
      stage.negativeDuration = formData.duration
    } else if (isNoTimer(t) || isPpt(t)) {
      stage.duration = 0
    } else if (isQuestion(t)) {
      stage.duration = formData.questionDuration || 0
    } else {
      stage.duration = formData.duration
    }
    stageChangeCounter.value++
  }

  function applyTemplate(tplId: string) {
    const tpl = debateTemplates.find(t => t.id === tplId)
    if (!tpl) return
    config.value.stages = tpl.stages.map(s => ({
      id: genTmpId(),
      ...s,
    }))
    showTemplateModal.value = false
    stageChangeCounter.value++
  }

  function openTemplateModal() {
    showTemplateModal.value = true
  }

  function closeTemplateModal() {
    showTemplateModal.value = false
  }

  // stages 签名（O(1) 浅比较，避免 deep watch 深度遍历）
  const stagesSignature = computed(() => {
    const stages = config.value.stages as Stage[]
    if (!stages.length) return 'empty'
    return `${stages.length}_${stages[0]?.id}_${stages[stages.length - 1]?.id}`
  })

  // 字段修改计数器：捕获非结构变化（单个字段修改）
  const stageChangeCounter = ref(0)

  // 配置变化时自动保存（防抖）
  watch(
    () => [stagesSignature.value, stageChangeCounter.value],
    () => {
      if (!initialLoadDone) return
      if (saveTimeout) clearTimeout(saveTimeout)
      saveTimeout = setTimeout(() => {
        if (!loading.value) savePageConfig()
      }, 1500)
    },
    { flush: 'sync' },
  )

  onMounted(() => loadPageConfig())

  // 卸载时 flush 未保存的修改，避免切页/关闭时丢失（两宿主一致行为）
  onBeforeUnmount(() => {
    if (saveTimeout) {
      clearTimeout(saveTimeout)
      savePageConfig()
    }
  })

  return {
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
    stagesSignature,
    stageChangeCounter,
    hostId,
    debateTemplates,
    loadPageConfig,
    savePageConfig,
    getDefaultStages,
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
    genTmpId,
    getStageSpeaker,
  }
}
