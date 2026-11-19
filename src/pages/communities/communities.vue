<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import TipsComponent from '@/components/tips.vue'
import { communitySections } from './communities.data'

defineOptions({
    name: 'CommunitiesPage'
})

const query = ref('')
const activeSection = ref(communitySections[0].id)
const copied = ref(false)
const copiedValue = ref('')

const normalized = computed(() => query.value.trim().toLowerCase())

const indexOf = (id: string) => communitySections.findIndex((s) => s.id === id) + 1

// 搜索时过滤每个分组的行；无匹配的分组整体隐藏
const sections = computed(() =>
    communitySections
        .map((s) => ({
            ...s,
            rows: normalized.value
                ? s.rows.filter((r) =>
                      `${r.value} ${r.description}`.toLowerCase().includes(normalized.value)
                  )
                : s.rows
        }))
        .filter((s) => !normalized.value || s.rows.length > 0)
)

const totalRows = communitySections.reduce((n, s) => n + s.rows.length, 0)
const totalMatches = computed(() => sections.value.reduce((n, s) => n + s.rows.length, 0))

const copy = async (value: string) => {
    try {
        await navigator.clipboard.writeText(value)
        copiedValue.value = value
        copied.value = true
    } catch {
        /* 剪贴板不可用时静默失败 */
    }
}

// 目录高亮：跟随滚动位置
let observer: IntersectionObserver | null = null
onMounted(() => {
    observer = new IntersectionObserver(
        (entries) => {
            const visible = entries.filter((e) => e.isIntersecting)
            if (visible.length) activeSection.value = visible[0].target.id
        },
        { rootMargin: '-80px 0px -65% 0px' }
    )
    document.querySelectorAll('.cm-section').forEach((el) => observer!.observe(el))
})
onUnmounted(() => observer?.disconnect())
</script>

<template>
    <div class="communities container">
        <header class="page-head">
            <div class="grid head-meta">
                <router-link to="/" class="back mono">← Index</router-link>
                <span class="mono hm-2">Reference</span>
                <span class="mono hm-3">{{ totalRows }} entries</span>
            </div>
            <h1 class="page-title">BGP<br /><em>Communities</em></h1>
            <div class="grid head-foot">
                <p class="lead">
                    Large communities supported by AS207529 for routing policy control. Click any
                    value to copy it.
                </p>
            </div>
        </header>

        <div class="grid layout">
            <aside class="toc">
                <div class="toc-inner">
                    <span class="label">Contents</span>
                    <nav>
                        <a
                            v-for="(s, i) in communitySections"
                            :key="s.id"
                            :href="`#${s.id}`"
                            :class="{ 'is-active': activeSection === s.id }"
                        >
                            <span class="mono">{{ i + 1 }}.</span> {{ s.title }}
                        </a>
                    </nav>
                    <a
                        class="arrow-link download"
                        href="https://geofeed.nyalo.li/communities-list.md"
                        target="_blank"
                        rel="noopener"
                    >
                        Download full list <span class="arr">↓</span>
                    </a>
                </div>
            </aside>

            <div class="content">
                <label class="search">
                    <span class="label">Search</span>
                    <span class="search-row">
                        <input
                            v-model="query"
                            type="search"
                            placeholder="prepend, 1030, Europe…"
                            aria-label="Search communities"
                        />
                        <span class="search-count mono">
                            {{ normalized ? totalMatches : totalRows }} / {{ totalRows }}
                        </span>
                    </span>
                </label>

                <section v-for="s in sections" :id="s.id" :key="s.id" class="cm-section">
                    <header class="cm-head">
                        <span class="cm-idx mono">{{ indexOf(s.id) }}.</span>
                        <h2 class="cm-title">{{ s.title }}</h2>
                    </header>
                    <p class="cm-summary">{{ s.summary }}</p>

                    <TipsComponent v-if="s.callout && !normalized" :title="s.callout.title">
                        <div class="callout-grid mono">
                            <template v-for="[k, v] in s.callout.lines" :key="k">
                                <span class="callout-key">{{ k }}</span>
                                <span>{{ v }}</span>
                            </template>
                        </div>
                    </TipsComponent>

                    <p v-if="s.note" class="cm-note">{{ s.note }}</p>

                    <div v-if="s.rows.length" class="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th class="mono">{{ s.columns[0] }}</th>
                                    <th class="mono">{{ s.columns[1] }}</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="row in s.rows" :key="row.value">
                                    <td>
                                        <button
                                            type="button"
                                            class="value mono"
                                            :title="`Copy ${row.value}`"
                                            @click="copy(row.value)"
                                        >
                                            {{ row.value }}
                                        </button>
                                    </td>
                                    <td>{{ row.description }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <div v-if="normalized && !sections.length" class="empty">
                    <p class="empty-title">No match.</p>
                    <p class="mono empty-q">“{{ query }}”</p>
                    <button type="button" class="arrow-link" @click="query = ''">
                        Clear search <span class="arr">→</span>
                    </button>
                </div>
            </div>
        </div>

        <v-snackbar
            v-model="copied"
            :timeout="1600"
            location="bottom left"
            rounded="0"
            color="primary"
            class="copy-toast"
        >
            <span class="mono">Copied {{ copiedValue }}</span>
        </v-snackbar>
    </div>
</template>

<style scoped lang="scss">
.page-head {
    padding-top: clamp(24px, 3vw, 40px);
    padding-bottom: clamp(48px, 6vw, 88px);
}

.head-meta {
    font-size: 12px;
    text-transform: uppercase;
    color: var(--text-2);
    padding-bottom: clamp(48px, 8vw, 120px);
}

.back {
    grid-column: 1 / span 3;
    text-decoration: none;
    color: var(--text);

    &:hover {
        color: var(--accent);
    }
}

.hm-2 {
    grid-column: 4 / span 3;
}

.hm-3 {
    grid-column: 7 / span 3;
}

.page-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(60px, 11vw, 168px);
    line-height: 0.92;
    font-weight: 300;
    letter-spacing: -0.055em;

    em {
        font-style: normal;
        font-weight: 700;
    }
}

.head-foot {
    margin-top: clamp(32px, 4vw, 56px);
}

.lead {
    grid-column: 4 / span 6;
    margin: 0;
    font-size: clamp(17px, 1.5vw, 21px);
    line-height: 1.45;
    color: var(--text-2);
}

/* ---------- layout ---------- */

.layout {
    border-top: 1px solid var(--rule);
}

.toc {
    grid-column: 1 / span 3;
}

.toc-inner {
    position: sticky;
    top: calc(var(--header-h) + 24px);
    padding-top: 16px;
}

.toc nav {
    display: flex;
    flex-direction: column;

    a {
        display: flex;
        gap: 10px;
        padding-block: 8px;
        border-bottom: 1px solid var(--hair);
        font-size: 15px;
        font-weight: 500;
        text-decoration: none;
        color: var(--text-2);
        transition:
            color 0.2s,
            padding 0.25s var(--ease);

        .mono {
            font-size: 12px;
            width: 18px;
            color: var(--text-3);
        }

        &:hover {
            color: var(--text);
        }

        &.is-active {
            color: var(--accent);
            padding-left: 8px;

            .mono {
                color: var(--accent);
            }
        }
    }
}

.download {
    margin-top: 32px;
    font-size: 15px;
}

.content {
    grid-column: 4 / -1;
    min-width: 0;
}

/* ---------- search ---------- */

.search {
    position: sticky;
    top: var(--header-h);
    z-index: 5;
    display: block;
    padding-top: 16px;
    padding-bottom: 12px;
    background: var(--bg);
    border-bottom: 1px solid var(--rule);
}

.search-row {
    display: flex;
    align-items: baseline;
    gap: 16px;
}

.search input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    color: var(--text);
    font-family: var(--font-display);
    font-size: clamp(24px, 2.6vw, 34px);
    font-weight: 300;
    letter-spacing: -0.035em;

    &::placeholder {
        color: var(--text-3);
    }
}

.search:focus-within {
    border-bottom-color: var(--accent);
}

.search-count {
    font-size: 12px;
    color: var(--text-2);
    white-space: nowrap;
}

/* ---------- sections ---------- */

.cm-section {
    padding-top: clamp(48px, 6vw, 80px);
}

.cm-head {
    display: flex;
    align-items: baseline;
    gap: 16px;
}

.cm-idx {
    font-size: 14px;
    color: var(--accent);
}

.cm-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(30px, 3.6vw, 48px);
    line-height: 1;
    font-weight: 600;
    letter-spacing: -0.045em;
}

.cm-summary {
    margin: 12px 0 28px;
    max-width: 60ch;
    font-size: 16px;
    line-height: 1.5;
    color: var(--text-2);
}

.cm-note {
    margin: 0;
    font-size: 15px;
    padding-block: 14px;
    border-top: 1px solid var(--rule);
    border-bottom: 1px solid var(--rule);
}

.callout-grid {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 6px 32px;
    white-space: nowrap;
    color: var(--text-2);
}

.callout-key {
    color: var(--text);
}

.cm-section :deep(.callout) {
    margin-bottom: 28px;
}

/* ---------- table ---------- */

.table-wrap {
    overflow-x: auto;
}

table {
    width: 100%;
    border-collapse: collapse;
    font-size: 15px;
}

th {
    text-align: left;
    font-size: 11px;
    font-weight: 400;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0 16px 8px 0;
    border-bottom: 1px solid var(--rule);
}

td {
    padding: 0 16px 0 0;
    border-bottom: 1px solid var(--hair);
    vertical-align: middle;
}

tbody tr {
    transition: background-color 0.15s;

    &:hover {
        background: var(--bg-2);
    }
}

/* Community 值保持单行，窄屏时表格横向滚动而不是折行 */
td:first-child {
    white-space: nowrap;
    width: 1%;
}

.value {
    display: block;
    padding: 11px 24px 11px 0;
    font-size: 13px;
    color: var(--text);
    text-align: left;
    transition: color 0.15s;

    &:hover {
        color: var(--accent);
    }

    &:focus-visible {
        outline: 2px solid var(--accent);
    }
}

.empty {
    padding-block: 80px;
}

.empty-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(44px, 6vw, 88px);
    font-weight: 300;
    letter-spacing: -0.05em;
    line-height: 1;
}

.empty-q {
    margin: 12px 0 32px;
    color: var(--text-2);
}

/* ---------- responsive ---------- */

@media (max-width: 900px) {
    .toc {
        display: none;
    }

    .content,
    .lead {
        grid-column: 1 / -1;
    }

    .back,
    .hm-2,
    .hm-3 {
        grid-column: span 4;
    }
}
</style>
