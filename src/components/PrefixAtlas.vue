<script setup lang="ts">
import { computed, ref } from 'vue'
import CountryFlag from '@/components/CountryFlag.vue'
import { usePrefixes, type PrefixKind } from '@/composables/usePrefixes'

defineOptions({
    name: 'PrefixAtlas'
})

const { prefixes, groups, total48, loading, error, refresh } = usePrefixes()

const KIND_ICON: Record<PrefixKind, string> = {
    site: '',
    broadband: '',
    anycast: 'mdi-access-point-network',
    infra: 'mdi-server-network',
    org: 'mdi-domain',
    unlabelled: 'mdi-circle-outline'
}

// 大小条：以对数刻度表示前缀覆盖的地址量，最短前缀为满格
const minLen = computed(() => Math.min(48, ...prefixes.value.map((p) => p.length)))
const barWidth = (len: number) => {
    const span = Math.max(1, 49 - minLen.value)
    return `${Math.max(6, ((49 - Math.min(len, 49)) / span) * 100)}%`
}

// 只为大于 /48 的前缀标注折算数量，/48 本身不重复写
const sizeNote = (len: number) => (len < 48 ? `${(2 ** (48 - len)).toLocaleString('en')} × /48` : '')

const stats = computed(() => [
    { label: 'Prefixes announced', value: String(prefixes.value.length) },
    { label: 'RIR allocations', value: String(groups.value.length) },
    { label: 'Address space', value: total48.value.toLocaleString('en'), unit: '× /48' }
])

// ---------- 复制 ----------

const copied = ref<string | null>(null)
let timer: number | undefined

async function copy(prefix: string) {
    try {
        await navigator.clipboard.writeText(prefix)
        copied.value = prefix
        window.clearTimeout(timer)
        timer = window.setTimeout(() => (copied.value = null), 1400)
    } catch {
        /* 剪贴板不可用时静默失败 */
    }
}
</script>

<template>
    <div class="atlas">
        <div v-if="loading && !prefixes.length" class="atlas-empty mono">Loading prefixes…</div>
        <div v-else-if="error" class="atlas-empty mono">
            Prefix data unavailable —
            <button type="button" class="retry" @click="refresh">retry</button>
        </div>

        <template v-else>
            <dl class="atlas-stats">
                <div v-for="s in stats" :key="s.label" class="stat">
                    <dt class="label">{{ s.label }}</dt>
                    <dd>
                        <span class="stat-v">{{ s.value }}</span>
                        <span v-if="s.unit" class="stat-u mono">{{ s.unit }}</span>
                    </dd>
                </div>
            </dl>

            <div class="groups">
                <section
                    v-for="(g, gi) in groups"
                    :key="g.parent"
                    class="group card"
                    :class="{ 'is-main': gi === 0 && groups.length > 2 }"
                >
                    <header class="group-head">
                        <span class="rir mono">{{ g.rir }}</span>
                        <span class="parent mono">{{ g.parent }}</span>
                        <span class="count mono">{{ g.rows.length }}</span>
                    </header>

                    <ul class="rows">
                        <li v-for="p in g.rows" :key="p.prefix">
                            <button
                                type="button"
                                class="row"
                                :class="{ 'is-copied': copied === p.prefix }"
                                :title="`Copy ${p.prefix}`"
                                @click="copy(p.prefix)"
                            >
                                <span class="row-icon">
                                    <CountryFlag v-if="p.cc" :code="p.cc" :size="18" />
                                    <i v-else class="mdi" :class="KIND_ICON[p.kind]" aria-hidden="true" />
                                </span>
                                <span class="row-main">
                                    <span class="row-prefix mono">
                                        {{ p.prefix.split('/')[0] }}<span class="row-len">/{{ p.length }}</span>
                                    </span>
                                    <span class="row-label" :class="`is-${p.kind}`">{{ p.label }}</span>
                                </span>
                                <span class="row-size" :title="sizeNote(p.length) || '/48'">
                                    <span class="bar"><span :style="{ width: barWidth(p.length) }" /></span>
                                    <span class="row-copy mono">{{ copied === p.prefix ? 'Copied' : sizeNote(p.length) || '\u00a0' }}</span>
                                </span>
                            </button>
                        </li>
                    </ul>
                </section>
            </div>
        </template>
    </div>
</template>

<style scoped lang="scss">
.atlas-empty {
    padding: 48px 0;
    font-size: 13px;
    color: var(--text-2);
}

.retry {
    font: inherit;
    color: var(--accent);
}

/* ---------- stats ---------- */

.atlas-stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--col-gap);
    margin: 0 0 28px;
    padding-bottom: 24px;
    border-bottom: 1px solid var(--line-2);

    dd {
        margin: 0;
        display: flex;
        align-items: baseline;
        gap: 8px;
    }
}

.stat-v {
    font-size: clamp(32px, 3.6vw, 52px);
    font-weight: 300;
    letter-spacing: -0.045em;
    line-height: 1;
    font-variant-numeric: tabular-nums;
}

.stat-u {
    font-size: 12px;
    color: var(--text-2);
}

/* ---------- groups ---------- */

.groups {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
    gap: 16px;
    align-items: start;
}

.group.is-main {
    grid-row: span 4;
}

.group {
    padding: 8px 8px 10px;
}

.group-head {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 10px 12px 12px;
    border-bottom: 1px solid var(--line);
    margin-bottom: 4px;
}

.rir {
    font-size: 10.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);
}

.parent {
    font-size: 13px;
    color: var(--text);
}

.count {
    margin-left: auto;
    font-size: 11px;
    color: var(--text-3);
}

.rows {
    list-style: none;
    margin: 0;
    padding: 0;
}

.row {
    width: 100%;
    display: grid;
    grid-template-columns: 22px minmax(0, 1fr) minmax(76px, 34%);
    gap: 12px;
    align-items: center;
    padding: 9px 12px;
    border-radius: 10px;
    text-align: left;
    transition: background-color 0.15s;

    &:hover {
        background: var(--line);

        .row-prefix {
            color: var(--accent);
        }
    }

    &:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: -2px;
    }

    &.is-copied .row-copy {
        color: var(--ok);
    }
}

.row-icon {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;

    .mdi {
        font-size: 16px;
        color: var(--text-2);
    }
}

.row-main {
    display: flex;
    flex-direction: column;
    min-width: 0;
}

.row-prefix {
    font-size: 13px;
    color: var(--text);
    overflow-wrap: anywhere;
    transition: color 0.15s;
}

.row-len {
    color: var(--accent);
}

.row-label {
    font-size: 12px;
    color: var(--text-2);

    &.is-unlabelled {
        color: var(--text-3);
    }
}

.row-size {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
}

.bar {
    height: 4px;
    border-radius: 2px;
    background: var(--line);
    overflow: hidden;

    span {
        display: block;
        height: 100%;
        border-radius: 2px;
        background: var(--accent);
        opacity: 0.8;
    }
}

.row-copy {
    font-size: 10.5px;
    color: var(--text-3);
    white-space: nowrap;
    transition: color 0.2s;
}

/* ---------- responsive ---------- */

@media (max-width: 900px) {
    .groups {
        grid-template-columns: 1fr;
    }

    .group.is-main {
        grid-row: auto;
    }
}

@media (max-width: 560px) {
    .atlas-stats {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        row-gap: 18px;
    }

    /* 窄屏：前缀里已有 /len，不再单独画大小条 */
    .row-size {
        display: none;
    }

    .row {
        grid-template-columns: 22px minmax(0, 1fr);
    }
}
</style>
