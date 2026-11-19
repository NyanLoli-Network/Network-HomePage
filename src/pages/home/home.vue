<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted } from 'vue'
import LatencyMatrix from '@/components/LatencyMatrix.vue'
import PrefixAtlas from '@/components/PrefixAtlas.vue'
import informationcard from './information.vue'
import peeringcard from './peering.vue'
import { useLatency } from '@/composables/useLatency'

// three.js 体积较大，异步加载，不阻塞首屏文字
const LatencyGlobe = defineAsyncComponent(() => import('@/components/globe/LatencyGlobe.vue'))

defineOptions({
    name: 'HomePage'
})

const { stats, measuredAgo, error, snapshot, start, stop } = useLatency()

onMounted(start)
onUnmounted(stop)

const fmtMs = (v: number | null) => (v === null ? '—' : `${v < 10 ? v.toFixed(1) : Math.round(v)}`)

const telemetry = computed(() => {
    const s = stats.value
    const ready = !!snapshot.value
    return [
        { label: 'Nodes online', value: ready ? `${s.online}/${s.total}` : '—', unit: '' },
        { label: 'Paths up', value: ready ? `${s.pathsUp}/${s.pathsTotal}` : '—', unit: '' },
        { label: 'Median RTT', value: ready ? fmtMs(s.median) : '—', unit: 'ms' },
        { label: 'Fastest path', value: ready ? fmtMs(s.fastest?.rtt_ms ?? null) : '—', unit: 'ms' }
    ]
})

const status = computed(() => {
    if (error.value === 'unavailable' && !snapshot.value) return { cls: 'is-idle', text: 'Snapshot temporarily unavailable' }
    if (error.value === 'network' && !snapshot.value) return { cls: 'is-idle', text: 'Live data unreachable' }
    if (!snapshot.value) return { cls: 'is-idle', text: 'Connecting…' }
    const s = stats.value
    const healthy = snapshot.value.all_connected
    return {
        cls: healthy ? '' : 'is-warn',
        text: `${healthy ? 'All paths up' : `${s.pathsTotal - s.pathsUp} path(s) degraded`} · measured ${measuredAgo.value}`
    }
})

const pillars = [
    {
        title: 'Non-profit',
        icon: 'mdi-hand-heart-outline',
        text: 'No paid tiers and no sales funnel. Transit is free for research and education, and peering is open to every network.',
        tags: ['Free transit', 'Open peering']
    },
    {
        title: 'Research',
        icon: 'mdi-flask-outline',
        text: 'A real IPv6-only backbone to experiment on in the open — routing policy, BGP communities and continuous latency measurement.',
        tags: ['IPv6 only', 'Live telemetry']
    },
    {
        title: 'Education',
        icon: 'mdi-school-outline',
        text: 'Hands-on experience with how the Internet is actually stitched together, for schools, labs, students and community networks.',
        tags: ['Schools', 'Labs', 'Students']
    }
]

const audiences = ['Universities', 'Research labs', 'Students', 'Open-source projects', 'Community networks']

const steps = [
    {
        title: 'Say hello',
        text: 'Email the NOC with your ASN and what you are researching, building or teaching.'
    },
    {
        title: 'Connect',
        text: 'Meet us at any IXP we share, or over a GRE, VXLAN or WireGuard tunnel.'
    },
    {
        title: 'Exchange routes',
        text: 'Open peering for everyone; free IP transit for research and education.'
    }
]

const sampleCommunities = [
    ['(207529, 1030, 8)', 'no export to route collectors'],
    ['(207529, 1212, 41)', 'prepend ×2 towards Europe'],
    ['(207529, 1102, 6939)', 'prepend ×1 to AS6939']
]

const pad = (i: number, n: number) => `${String(i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`
</script>

<template>
    <div class="home">
        <LatencyGlobe />

        <!-- ============ Hero ============ -->
        <section class="hero">
            <div class="container hero-inner">
                <div class="eyebrow hero-eyebrow">
                    Research <span class="sep">//</span> Education <span class="sep">//</span> Non-profit
                </div>

                <h1 class="asn" aria-label="AS207529">
                    <span class="asn-as">AS</span>207529
                </h1>
                <div class="asn-rule" aria-hidden="true" />

                <p class="display tagline">
                    <b>Research</b> network, not for profit.
                </p>
                <p class="hero-lead">
                    NyanLoli Network is a non-profit, IPv6-only research &amp; education network
                    operated by NYANLOLI LTD. Open peering for everyone — free transit for schools,
                    labs and students.
                </p>
                <div class="hero-cta">
                    <a href="#join" class="pill-link">Join the network <span class="arr">→</span></a>
                    <a href="#latency" class="pill-link is-ghost">Live latency</a>
                </div>
            </div>
        </section>

        <!-- ============ Live status ============ -->
        <section class="status" aria-label="Live network status">
            <div class="container">
                <div class="telemetry card">
                    <div class="tele-status mono">
                        <span class="live-dot" :class="status.cls" />
                        <span>{{ status.text }}</span>
                    </div>
                    <dl class="tele-grid">
                        <div v-for="t in telemetry" :key="t.label" class="tele">
                            <dt class="label">{{ t.label }}</dt>
                            <dd>
                                <span class="tele-v">{{ t.value }}</span>
                                <span v-if="t.unit && t.value !== '—'" class="tele-u mono">{{ t.unit }}</span>
                            </dd>
                        </div>
                    </dl>
                </div>
            </div>
        </section>

        <!-- ============ 01 Mission ============ -->
        <section id="mission" class="section">
            <div class="container">
                <div class="section-head">
                    <div class="eyebrow"><span class="n">01</span> <span class="sep">//</span> Mission</div>
                    <h2 class="display h2">Built for learning,<br /><b>not for profit.</b></h2>
                    <p class="lead">
                        We run a real Internet backbone so that people can learn from one. Every
                        decision — IPv6 only, open peering, free transit for academia — serves
                        research and education first. Formerly known as LoliNya Network.
                    </p>
                </div>

                <div class="pillars">
                    <article v-for="(p, i) in pillars" :key="p.title" class="pillar card">
                        <div class="pillar-top">
                            <span class="pillar-icon"><i class="mdi" :class="p.icon" aria-hidden="true" /></span>
                            <span class="counter">{{ pad(i, pillars.length) }}</span>
                        </div>
                        <h3 class="pillar-title">{{ p.title }}</h3>
                        <p class="pillar-text">{{ p.text }}</p>
                        <div class="pillar-tags mono">
                            <template v-for="(t, j) in p.tags" :key="t">
                                <span v-if="j" class="sep">//</span>{{ t }}
                            </template>
                        </div>
                    </article>
                </div>

                <div class="audience">
                    <span class="label">Who we welcome</span>
                    <ul>
                        <li v-for="a in audiences" :key="a">{{ a }}</li>
                    </ul>
                </div>
            </div>
        </section>

        <!-- ============ 02 Latency ============ -->
        <section id="latency" class="section latency">
            <div class="container">
                <div class="section-head">
                    <div class="eyebrow"><span class="n">02</span> <span class="sep">//</span> Live latency</div>
                    <h2 class="display h2">Every path,<br /><b>both directions.</b></h2>
                    <p class="lead">
                        Each node probes every other node, and each direction is measured on its
                        own — round trips are rarely symmetric. Hover or tap a cell to trace the path
                        on the globe.
                    </p>
                </div>

                <div class="grid latency-grid">
                    <!-- 地球滚动到这里时会停靠进这个预留位置 -->
                    <div class="globe-col">
                        <div class="globe-slot" data-globe-slot aria-hidden="true" />
                    </div>
                    <div class="matrix-col">
                        <LatencyMatrix />
                        <p class="footnote mono">
                            Snapshot refreshes about once a minute. Locations are country-level, so
                            distances are approximate.
                        </p>
                    </div>
                </div>
            </div>
        </section>

        <!-- ============ 03 Address space ============ -->
        <section id="prefixes" class="section">
            <div class="container">
                <div class="section-head">
                    <div class="eyebrow"><span class="n">03</span> <span class="sep">//</span> Address space</div>
                    <h2 class="display h2">Where our<br /><b>prefixes live.</b></h2>
                    <p class="lead">
                        IPv6 prefixes announced by AS207529, grouped by the RIR allocation they come
                        from. Click any prefix to copy it.
                    </p>
                </div>
                <div>
                    <PrefixAtlas />
                </div>
            </div>
        </section>

        <!-- ============ 04 Join ============ -->
        <section id="join" class="section">
            <div class="container">
                <div class="section-head">
                    <div class="eyebrow"><span class="n">04</span> <span class="sep">//</span> Join</div>
                    <h2 class="display h2">Join the<br /><b>research network.</b></h2>
                    <p class="lead">
                        Three steps from first email to exchanging routes. We welcome peering with
                        other research and education networks.
                    </p>
                </div>

                <ol class="steps">
                    <li v-for="(s, i) in steps" :key="s.title" class="step card">
                        <span class="counter">{{ pad(i, steps.length) }}</span>
                        <h3 class="step-title">{{ s.title }}</h3>
                        <p class="step-text">{{ s.text }}</p>
                    </li>
                </ol>

                <div class="grid ledgers">
                    <div class="ledger-a"><informationcard /></div>
                    <div class="ledger-b"><peeringcard /></div>
                </div>
            </div>
        </section>

        <!-- ============ 04 Communities ============ -->
        <section class="section">
            <div class="container">
                <router-link to="/communities" class="communities-card card">
                    <div class="cc-copy">
                        <div class="eyebrow"><span class="n">05</span> <span class="sep">//</span> Routing control</div>
                        <h2 class="display cc-title">
                            Steer your routes with <b>BGP communities</b><span class="cc-arr">→</span>
                        </h2>
                        <p class="lead">Suppress, prepend or scope announcements by ASN, region and country.</p>
                    </div>
                    <pre class="cc-code mono"><code><template v-for="[v, c] in sampleCommunities" :key="v"><span class="c-v">{{ v.padEnd(22) }}</span><span class="c-c"># {{ c }}</span>
</template></code></pre>
                </router-link>
            </div>
        </section>

        <!-- ============ 05 Contact ============ -->
        <section class="section contact">
            <div class="container">
                <div class="eyebrow"><span class="n">06</span> <span class="sep">//</span> Contact</div>
                <a href="mailto:noc@nyanloli.com" class="display contact-mail">
                    noc@<b>nyanloli</b>.com
                </a>
                <div class="contact-meta">
                    <p class="lead">
                        Questions about peering, transit or a research project? Our NOC is happy to help.
                    </p>
                    <a href="https://t.me/Ximineko" target="_blank" rel="noopener" class="arrow-link">
                        Telegram @Ximineko <span class="arr">↗</span>
                    </a>
                </div>
            </div>
        </section>
    </div>
</template>

<style scoped lang="scss">
.home {
    position: relative;
}

/* 正文浮于固定的 3D 背景之上 */
.hero,
.section {
    position: relative;
    z-index: 1;
}

/* ---------- Hero ---------- */

.hero {
    min-height: calc(100svh - var(--header-h));
    display: flex;
    flex-direction: column;
    pointer-events: none; /* 空白处让给地球拖拽 */

    a,
    button,
    p,
    h1,
    .telemetry {
        pointer-events: auto;
    }
}

.hero-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding-top: clamp(28px, 6vh, 72px);
}

.hero-eyebrow {
    justify-content: center;
}

.asn {
    margin: 18px 0 0;
    font-size: clamp(72px, 13.4vw, 196px);
    font-weight: 600;
    line-height: 0.92;
    letter-spacing: -0.06em;
    font-variant-numeric: tabular-nums;
    /* 光学居中：负字距会让右侧多出空白 */
    margin-right: -0.06em;
}

.asn-as {
    color: var(--accent);
}

.asn-rule {
    width: min(100%, 860px);
    height: 1px;
    margin-top: clamp(16px, 2.4vw, 28px);
    background: linear-gradient(90deg, transparent, var(--accent) 30%, var(--accent) 70%, transparent);
    opacity: 0.55;
}

.tagline {
    text-wrap: balance;
    margin-top: clamp(20px, 3vw, 36px);
    font-size: clamp(28px, 3.8vw, 52px);
}

.hero-lead {
    max-width: 50ch;
    margin: 18px 0 0;
    font-size: clamp(15px, 1.25vw, 17px);
    line-height: 1.6;
    color: var(--text-2);
}

.hero-cta {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
    margin-top: 30px;
}

.status {
    position: relative;
    z-index: 1;
}

/* ---------- telemetry ---------- */

.telemetry {
    max-width: 980px;
    margin-inline: auto;
    padding: 16px 22px 20px;
}

.tele-status {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 11.5px;
    color: var(--text-2);
    padding-bottom: 14px;
    border-bottom: 1px solid var(--line);
}

.tele-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--col-gap);
    margin: 0;
    padding-top: 16px;
}

.tele dd {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: 6px;
}

.tele-v {
    font-size: clamp(26px, 2.8vw, 40px);
    font-weight: 300;
    letter-spacing: -0.04em;
    line-height: 1;
    font-variant-numeric: tabular-nums;
}

.tele-u {
    font-size: 12px;
    color: var(--text-2);
}

/* ---------- section scaffolding ---------- */

.section-head {
    max-width: 720px;
    margin-bottom: clamp(40px, 5vw, 64px);
}

/* ---------- mission ---------- */

.pillars {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
}

.pillar {
    display: flex;
    flex-direction: column;
    padding: 22px 24px 22px;
    min-height: 280px;

    &:hover {
        .pillar-icon {
            background: var(--accent);
            border-color: var(--accent);
            color: var(--on-accent);
        }
    }
}

.pillar-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
}

/* 图标方块：品牌色淡底，悬停时填满 */
.pillar-icon {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: 14px;
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
    color: var(--accent);
    font-size: 24px;
    transition:
        background-color 0.3s,
        border-color 0.3s,
        color 0.3s;
}

.pillar-title {
    margin: 44px 0 10px;
    font-size: clamp(26px, 2.4vw, 34px);
    font-weight: 600;
    letter-spacing: -0.04em;
}

.pillar-text {
    flex: 1;
    margin: 0;
    font-size: 15px;
    line-height: 1.6;
    color: var(--text-2);
}

.pillar-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 20px;
    padding-top: 14px;
    border-top: 1px solid var(--line);
    font-size: 10.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);

    .sep {
        color: var(--text-3);
    }
}

.audience {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 20px;
    margin-top: 28px;

    .label {
        margin: 0;
    }

    ul {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        list-style: none;
        margin: 0;
        padding: 0;
    }

    li {
        padding: 6px 14px;
        border-radius: 999px;
        border: 1px solid var(--line-2);
        font-size: 13px;
        color: var(--text-2);
    }
}

/* ---------- latency ---------- */

/* 空白处让给停靠在左侧的地球（拖拽 / 悬停） */
.latency {
    pointer-events: none;

    .section-head,
    .matrix-col {
        pointer-events: auto;
    }
}

.latency-grid {
    align-items: start;
}

.globe-col {
    grid-column: 1 / span 5;
    height: 100%;
}

.globe-slot {
    position: sticky;
    top: calc(var(--header-h) + 24px);
    width: 100%;
    aspect-ratio: 1;
    max-height: calc(100svh - var(--header-h) - 64px);
    margin-inline: auto;
    border-radius: 50%;
}

.matrix-col {
    grid-column: 6 / -1;
}

.footnote {
    margin-top: 16px;
    font-size: 11px;
    line-height: 1.7;
    color: var(--text-3);
}

/* ---------- join ---------- */

.steps {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    list-style: none;
    padding: 0;
    margin: 0 0 clamp(56px, 7vw, 96px);
    counter-reset: none;
}

.step {
    padding: 22px 24px 24px;
}

.step-title {
    margin: 36px 0 8px;
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.03em;
}

.step-text {
    margin: 0;
    font-size: 15px;
    line-height: 1.6;
    color: var(--text-2);
}

.ledgers {
    row-gap: 56px;
}

.ledger-a {
    grid-column: 1 / span 6;
}

.ledger-b {
    grid-column: 7 / span 6;
}

/* ---------- communities ---------- */

.communities-card {
    display: grid;
    grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
    gap: 40px;
    align-items: end;
    padding: clamp(28px, 4vw, 52px);
    border-radius: 20px;
    text-decoration: none;
    color: var(--text);

    &:hover .cc-arr {
        transform: translateX(10px);
        color: var(--accent);
    }

    &:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 4px;
    }
}

.cc-title {
    margin-top: 18px;
    font-size: clamp(32px, 3.8vw, 54px);
}

.cc-arr {
    display: inline-block;
    margin-left: 0.25em;
    font-weight: 300;
    transition:
        transform 0.4s var(--ease),
        color 0.3s;
}

.cc-code {
    margin: 0;
    padding: 18px 20px;
    border-radius: 12px;
    background: var(--bg);
    border: 1px solid var(--line);
    font-size: 12px;
    line-height: 2;
    overflow-x: auto;
}

.c-v {
    color: var(--accent);
}

.c-c {
    color: var(--text-3);
}

/* ---------- contact ---------- */

.contact-mail {
    display: inline-block;
    margin-top: 24px;
    font-size: clamp(40px, 8.4vw, 132px);
    line-height: 1;
    text-decoration: none;
    overflow-wrap: anywhere;
    background: linear-gradient(var(--accent), var(--accent)) no-repeat left 96% / 0 2px;
    transition:
        background-size 0.6s var(--ease),
        color 0.3s;

    &:hover {
        background-size: 100% 2px;
    }
}

.contact-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px 40px;
    margin-top: 28px;

    .lead {
        margin: 0;
    }
}

/* ---------- responsive ---------- */

@media (max-width: 1024px) {
    .globe-col,
    .matrix-col {
        grid-column: 1 / -1;
    }

    /* 窄屏：地球放在矩阵上方 */
    .globe-slot {
        position: relative;
        top: auto;
        width: min(100%, 380px);
        margin-bottom: 40px;
    }

    .communities-card {
        grid-template-columns: 1fr;
    }

    .pillars,
    .steps {
        grid-template-columns: 1fr;
    }

    .pillar {
        min-height: 0;
    }

    .pillar-title {
        margin-top: 32px;
    }
}

@media (max-width: 860px) {
    .tele-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        row-gap: 20px;
    }

    .ledger-a,
    .ledger-b {
        grid-column: 1 / -1;
    }
}

</style>
