<script setup lang="ts">
import { computed, ref } from 'vue'
import { useLatency, greatCircleKm } from '@/composables/useLatency'
import CountryFlag from '@/components/CountryFlag.vue'
import type { LatencyLink, LatencyNode } from '@/types/latency'

defineOptions({
    name: 'LatencyMatrix'
})

const { nodes, stats, link, labelOf, focus, error, snapshot, nodeById } = useLatency()

// 自西向东排序：矩阵自然出现「洲际分块」结构
const ordered = computed(() =>
    [...nodes.value].sort(
        (a, b) => (a.location?.longitude ?? 999) - (b.location?.longitude ?? 999) || a.id.localeCompare(b.id)
    )
)

const maxRtt = computed(() => Math.max(1, stats.value.max ?? 1))

/** 平方根比例：同城几毫秒与洲际两百毫秒都能分辨 */
const intensity = (rtt: number) => Math.sqrt(Math.min(rtt, maxRtt.value) / maxRtt.value)

const cellStyle = (l: LatencyLink | undefined) => {
    if (!l || l.state !== 'ok' || l.rtt_ms === null) return {}
    const k = intensity(l.rtt_ms)
    return {
        '--mix': `${Math.round(6 + k * 84)}%`,
        '--ink': k > 0.62 ? 'var(--on-accent)' : 'var(--text)'
    }
}

const fmt = (ms: number) => (ms < 10 ? ms.toFixed(1) : Math.round(ms).toString())

const stateLabel: Record<string, string> = {
    offline: 'off',
    unconfigured: 'cfg',
    busy: 'busy',
    error: 'err'
}

// ---------- 交互 ----------

const active = ref<{ s: string; t: string } | null>(null)

function enter(s: LatencyNode, t: LatencyNode) {
    if (s.id === t.id) return
    active.value = { s: s.id, t: t.id }
    focus.value = { kind: 'pair', a: s.id, b: t.id }
}

function leave() {
    active.value = null
    focus.value = null
}

const detail = computed(() => {
    const pair = active.value
    let s: LatencyNode | undefined
    let t: LatencyNode | undefined
    if (pair) {
        s = nodeById.value.get(pair.s)
        t = nodeById.value.get(pair.t)
    } else if (stats.value.fastest) {
        // 默认展示最快路径
        s = nodeById.value.get(stats.value.fastest.source_id)
        t = nodeById.value.get(stats.value.fastest.target_id)
    }
    if (!s || !t) return null
    const fwd = link(s.id, t.id)
    const back = link(t.id, s.id)
    const km = greatCircleKm(s, t)
    return {
        isDefault: !pair,
        from: s,
        to: t,
        fwd,
        back,
        km
    }
})

const legendTicks = computed(() => {
    const max = maxRtt.value
    return [0, 10, 50, 100, 200].filter((v) => v <= max).map((v) => ({ v, left: `${Math.sqrt(v / max) * 100}%` }))
})
</script>

<template>
    <div class="matrix-wrap">
        <div v-if="!snapshot" class="matrix-empty mono">
            <template v-if="error === 'unavailable'">Snapshot temporarily unavailable — retrying shortly.</template>
            <template v-else-if="error">Latency data could not be loaded.</template>
            <template v-else>Loading latency snapshot…</template>
        </div>

        <template v-else>
            <div class="matrix-scroll">
                <table class="matrix" @mouseleave="leave">
                    <caption class="sr-only">
                        Round-trip time in milliseconds from each row (source) to each column (target)
                    </caption>
                    <thead>
                        <tr>
                            <th class="corner mono" scope="col">
                                <span class="corner-title">Country / Region</span>
                                <span>from ↓ · to →</span>
                            </th>
                            <th
                                v-for="(n, j) in ordered"
                                :key="n.id"
                                scope="col"
                                class="col-head mono"
                                :class="{ 'is-on': active?.t === n.id }"
                                :title="labelOf(n)"
                            >
                                <span class="ch">
                                    <CountryFlag :code="n.location?.country_code" :size="16" />
                                    <span>{{ j + 1 }}</span>
                                </span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(s, i) in ordered" :key="s.id">
                            <th scope="row" class="row-head" :class="{ 'is-on': active?.s === s.id }">
                                <span class="rh-i mono">{{ i + 1 }}</span>
                                <CountryFlag :code="s.location?.country_code" :size="18" class="rh-flag" />
                                <span class="rh-name">{{ labelOf(s) }}</span>
                                <span
                                    v-if="s.state !== 'online'"
                                    class="rh-state mono"
                                    :title="s.state"
                                    >{{ s.state === 'offline' ? 'off' : 'cfg' }}</span
                                >
                            </th>
                            <td v-for="t in ordered" :key="t.id" class="cell-td">
                                <span v-if="s.id === t.id" class="cell is-self" />
                                <button
                                    v-else
                                    type="button"
                                    class="cell mono"
                                    :class="{
                                        'is-ok': link(s.id, t.id)?.state === 'ok',
                                        'is-bad': link(s.id, t.id) && link(s.id, t.id)!.state !== 'ok',
                                        'is-active': active?.s === s.id && active?.t === t.id,
                                        'is-cross': active && (active.s === s.id || active.t === t.id)
                                    }"
                                    :style="cellStyle(link(s.id, t.id))"
                                    :aria-label="`${labelOf(s)} to ${labelOf(t)}: ${
                                        link(s.id, t.id)?.rtt_ms != null
                                            ? link(s.id, t.id)!.rtt_ms!.toFixed(1) + ' ms'
                                            : link(s.id, t.id)?.state ?? 'no data'
                                    }`"
                                    @mouseenter="enter(s, t)"
                                    @focus="enter(s, t)"
                                    @blur="leave"
                                >
                                    <template v-if="link(s.id, t.id)?.state === 'ok'">{{
                                        fmt(link(s.id, t.id)!.rtt_ms!)
                                    }}</template>
                                    <template v-else-if="link(s.id, t.id)">{{
                                        stateLabel[link(s.id, t.id)!.state]
                                    }}</template>
                                    <template v-else>·</template>
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="legend mono" aria-hidden="true">
                <span class="legend-title">RTT, ms</span>
                <div class="legend-bar">
                    <span v-for="t in legendTicks" :key="t.v" class="tick" :style="{ left: t.left }">{{
                        t.v
                    }}</span>
                </div>
                <span class="legend-note"><i class="swatch-bad" /> not measured / down</span>
            </div>

            <div v-if="detail" class="detail" aria-live="polite">
                <div class="detail-head">
                    <span class="label">{{ detail.isDefault ? 'Fastest path' : 'Selected path' }}</span>
                    <div class="route">
                        <span class="route-end">
                            <CountryFlag :code="detail.from.location?.country_code" :size="28" />
                            {{ labelOf(detail.from) }}
                        </span>
                        <span class="route-arrow">⇄</span>
                        <span class="route-end">
                            <CountryFlag :code="detail.to.location?.country_code" :size="28" />
                            {{ labelOf(detail.to) }}
                        </span>
                    </div>
                </div>
                <dl class="detail-grid">
                    <div>
                        <dt class="label">Forward RTT</dt>
                        <dd class="mono">
                            {{ detail.fwd?.state === 'ok' ? `${detail.fwd.rtt_ms!.toFixed(2)} ms` : detail.fwd?.state ?? 'n/a' }}
                        </dd>
                    </div>
                    <div>
                        <dt class="label">Return RTT</dt>
                        <dd class="mono">
                            {{ detail.back?.state === 'ok' ? `${detail.back.rtt_ms!.toFixed(2)} ms` : detail.back?.state ?? 'n/a' }}
                        </dd>
                    </div>
                    <div>
                        <dt class="label">Distance ≈</dt>
                        <dd class="mono">
                            {{ detail.km === null ? 'n/a' : detail.km < 150 ? 'same region' : `${Math.round(detail.km).toLocaleString('en')} km` }}
                        </dd>
                    </div>
                </dl>
            </div>
        </template>
    </div>
</template>

<style scoped lang="scss">
.sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
}

.matrix-wrap {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    padding: clamp(14px, 2vw, 24px);
}

.matrix-empty {
    padding: 64px 16px;
    text-align: center;
    font-size: 13px;
    color: var(--text-2);
}

.matrix-scroll {
    overflow-x: auto;
    margin-inline: -4px;
    padding-inline: 4px;
}

.matrix {
    border-collapse: separate;
    border-spacing: 3px;
    width: 100%;
    min-width: 540px;
}

th {
    font-weight: 400;
}

.corner {
    text-align: left;
    vertical-align: bottom;
    font-size: 10px;
    color: var(--text-3);
    letter-spacing: 0.04em;
    padding: 0 8px 6px 0;
    white-space: nowrap;

    > span {
        display: block;
    }
}

/* 行标题列的列名 */
.corner-title {
    margin-bottom: 4px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-2);
}

.col-head {
    font-size: 11px;
    color: var(--text-3);
    padding-bottom: 6px;
    transition: color 0.15s;

    &.is-on {
        color: var(--accent);
    }
}

/* 列头：国旗 + 序号（同国家多个节点时靠序号区分） */
.ch {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
}

.row-head {
    text-align: left;
    white-space: nowrap;
    padding-right: 10px;
    font-size: 13px;
    transition: color 0.15s;

    &.is-on {
        color: var(--accent);

        .rh-i {
            color: var(--accent);
        }
    }
}

.rh-i {
    display: inline-block;
    width: 18px;
    font-size: 11px;
    color: var(--text-3);
}

.rh-flag {
    margin-right: 8px;
}

.rh-name {
    font-weight: 500;
}

.rh-state {
    margin-left: 6px;
    font-size: 10px;
    color: var(--warn);
}

.cell-td {
    padding: 0;
}

.cell {
    display: grid;
    place-items: center;
    width: 100%;
    min-width: 40px;
    aspect-ratio: 1.35;
    border-radius: 5px;
    font-size: 11.5px;
    color: var(--text-3);
    background: var(--bg-2);
    transition:
        transform 0.15s var(--ease),
        box-shadow 0.15s,
        opacity 0.2s;

    &.is-self {
        background: repeating-linear-gradient(
            -45deg,
            transparent 0 3px,
            var(--line) 3px 4px
        );
    }

    &.is-ok {
        background: color-mix(in oklch, var(--bg-2), var(--accent) var(--mix));
        color: var(--ink);
    }

    &.is-bad {
        background: transparent;
        border: 1px dashed var(--warn);
        color: var(--warn);
    }

    &.is-active {
        transform: scale(1.12);
        box-shadow: 0 0 0 2px var(--text);
        position: relative;
        z-index: 1;
    }

    &:focus-visible {
        outline: 2px solid var(--text);
        outline-offset: 1px;
    }
}

/* 悬停时，非同行同列的格子退后 */
.matrix:has(.is-active) .cell.is-ok:not(.is-cross),
.matrix:has(.is-active) .cell.is-bad:not(.is-cross) {
    opacity: 0.35;
}

/* ---------- legend ---------- */

.legend {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px 18px;
    margin-top: 18px;
    font-size: 10.5px;
    color: var(--text-2);
}

.legend-bar {
    position: relative;
    flex: 1 1 180px;
    max-width: 320px;
    height: 8px;
    border-radius: 2px;
    background: linear-gradient(
        to right in oklch,
        color-mix(in oklch, var(--bg-2), var(--accent) 6%),
        color-mix(in oklch, var(--bg-2), var(--accent) 90%)
    );
    margin-bottom: 14px;
}

.tick {
    position: absolute;
    top: 12px;
    transform: translateX(-50%);
    color: var(--text-3);

    &::before {
        content: '';
        position: absolute;
        top: -6px;
        left: 50%;
        width: 1px;
        height: 4px;
        background: var(--text-3);
    }
}

.legend-note {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 14px;
}

.swatch-bad {
    width: 14px;
    height: 10px;
    border: 1px dashed var(--warn);
    border-radius: 2px;
}

/* ---------- detail ---------- */

.detail {
    margin-top: 8px;
    padding-top: 18px;
    border-top: 1px solid var(--line);
}

.route {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    font-family: var(--font-display);
    font-size: clamp(24px, 2.6vw, 34px);
    font-weight: 300;
    letter-spacing: -0.035em;
    line-height: 1.1;
}

.route-end {
    display: inline-flex;
    align-items: center;
    gap: 10px;
}

.route-arrow {
    color: var(--accent);
    font-family: var(--font-sans);
    font-size: 0.6em;
}

.detail-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    margin: 18px 0 0;

    dd {
        margin: 0;
        font-size: 15px;
    }
}

@media (max-width: 640px) {
    .detail-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    /* 横向滚动时节点名固定在左侧 */
    .row-head,
    .corner {
        position: sticky;
        left: 0;
        z-index: 2;
        background: var(--bg);
        box-shadow: 6px 0 8px -6px var(--bg);
    }
}
</style>
