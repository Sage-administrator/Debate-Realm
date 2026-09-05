<script setup lang="ts">
// 淘汰赛对阵表组件 - 思维导图风格
// 根据轮次数据自动生成淘汰赛对阵树状图

// 组件入参定义
interface Props {
  matches: MatchItem[] // 所有比赛对阵列表
  showScores?: boolean // 是否显示比分
}

// 单场对阵项的数据结构
interface MatchItem {
  id: string // 对阵唯一标识
  round: number // 所属轮次（1 为第一轮，逐级递增）
  teamA?: string | null // A 方队伍标识
  teamB?: string | null // B 方队伍标识
  scoreA?: number | null // A 方得分
  scoreB?: number | null // B 方得分
  winner?: string | null // 胜出的队伍标识
  status: string // 对阵状态：finished/running/pending
  teamAName?: string // A 方展示名
  teamBName?: string // B 方展示名
}

const props = withDefaults(defineProps<Props>(), {
  showScores: true,
})

// 根据轮次分组
const rounds = computed(() => {
  const roundMap = new Map<number, MatchItem[]>()
  for (const m of props.matches) {
    const r = m.round
    if (!roundMap.has(r)) roundMap.set(r, [])
    roundMap.get(r)!.push(m)
  }
  // 按轮次排序
  return Array.from(roundMap.entries()).sort((a, b) => a[0] - b[0])
})

// 轮次标签
function roundLabel(round: number, totalRounds: number) {
  if (round === totalRounds) return '决赛'
  if (round === totalRounds - 1) return '半决赛'
  if (round === totalRounds - 2) return '四分之一决赛'
  return `第${round}轮`
}

// 获取比分显示
function scoreDisplay(m: MatchItem) {
  if (m.status === 'finished' && m.scoreA != null && m.scoreB != null) {
    return `${m.scoreA} : ${m.scoreB}`
  }
  return '- : -'
}

// 判断是否是胜利方
function isWinner(m: MatchItem, team: string | null | undefined) {
  return m.status === 'finished' && !!team && m.winner === team
}

// 球队名称简写
function shortName(name: string | null | undefined) {
  if (!name) return '待定'
  return name.length > 6 ? name.slice(0, 6) + '...' : name
}

// 总轮次数（用于判断决赛/半决赛等标签）
const totalRounds = computed(() => rounds.value.length)
</script>

<template>
  <div class="bracket-view">
    <div v-if="rounds.length === 0" class="text-center py-8 text-gray-400">暂无对阵数据</div>

    <!-- 淘汰赛对阵树 -->
    <div v-else class="bracket-tree">
      <!-- 每一列代表一轮 -->
      <div class="bracket-rounds">
        <div v-for="(round, roundIdx) in rounds" :key="round[0]" class="bracket-round">
          <!-- 轮次标题 -->
          <div class="bracket-round-title">
            {{ roundLabel(round[0], totalRounds) }}
          </div>

          <!-- 该轮的所有对阵 -->
          <div class="bracket-matches">
            <div v-for="match in round[1]" :key="match.id" class="bracket-match">
              <!-- 球队A -->
              <div
                class="bracket-slot"
                :class="{
                  'winner-slot': isWinner(match, match.teamA),
                  'has-result': match.status === 'finished',
                }"
              >
                <span class="slot-name" :title="match.teamA || '待定'">
                  {{ shortName(match.teamA) }}
                </span>
                <span v-if="showScores && match.status === 'finished'" class="slot-score">
                  {{ match.scoreA }}
                </span>
              </div>

              <!-- 比分分隔线 -->
              <div class="slot-divider" />

              <!-- 球队B -->
              <div
                class="bracket-slot"
                :class="{
                  'winner-slot': isWinner(match, match.teamB),
                  'has-result': match.status === 'finished',
                }"
              >
                <span class="slot-name" :title="match.teamB || '待定'">
                  {{ shortName(match.teamB) }}
                </span>
                <span v-if="showScores && match.status === 'finished'" class="slot-score">
                  {{ match.scoreB }}
                </span>
              </div>

              <!-- 状态标签 -->
              <UBadge
                class="match-status-badge"
                :label="
                  match.status === 'finished'
                    ? '已完'
                    : match.status === 'running'
                      ? '进行中'
                      : '待开'
                "
                :color="
                  match.status === 'finished'
                    ? 'success'
                    : match.status === 'running'
                      ? 'primary'
                      : 'neutral'
                "
                size="xs"
                variant="soft"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bracket-view {
  overflow-x: auto;
  padding: 16px 0;
}

.bracket-tree {
  min-width: max-content;
}

.bracket-rounds {
  display: flex;
  gap: 40px;
  align-items: stretch;
}

.bracket-round {
  display: flex;
  flex-direction: column;
  min-width: 160px;
}

.bracket-round-title {
  text-align: center;
  font-weight: 700;
  font-size: 14px;
  color: var(--ui-primary);
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--ui-border);
}

.bracket-matches {
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  flex: 1;
  gap: 12px;
}

.bracket-match {
  position: relative;
  border: 1px solid var(--ui-border);
  border-radius: 8px;
  background: var(--ui-bg);
  overflow: hidden;
  transition: all 0.2s;
}

.bracket-match:hover {
  border-color: var(--ui-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.bracket-slot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  font-size: 13px;
  transition: background 0.2s;
}

.bracket-slot:first-child {
  border-bottom: 1px solid var(--ui-border);
}

.slot-name {
  font-weight: 500;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slot-score {
  font-weight: 700;
  color: var(--ui-primary);
  min-width: 20px;
  text-align: right;
}

.winner-slot {
  background: rgba(34, 197, 94, 0.06);
}

.winner-slot .slot-name {
  color: #16a34a;
  font-weight: 700;
}

.has-result .slot-name {
  color: var(--ui-text);
}

.slot-divider {
  display: none;
}

.match-status-badge {
  position: absolute;
  top: -1px;
  right: -1px;
  border-radius: 0 8px 0 6px;
  font-size: 10px;
  padding: 1px 5px;
}

/* 连接线 - 用于显示轮次间的晋级关系 */
.bracket-round:not(:last-child)::after {
  content: '';
  position: absolute;
  right: -20px;
  top: 50%;
  width: 0;
  height: 0;
}
</style>
