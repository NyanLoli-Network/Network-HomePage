<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useTheme } from 'vuetify'
import { GlobeScene, type ProjectedSite, type Site } from './GlobeScene'
import { useLatency, regionName } from '@/composables/useLatency'
import CountryFlag from '@/components/CountryFlag.vue'

defineOptions({
    name: 'LatencyGlobe'
})

const { snapshot, nodeById, focus, link, labelOf } = useLatency()
const theme = useTheme()
const isDark = computed(() => theme.global.current.value.dark)

const root = ref<HTMLElement>()
const canvas = ref<HTMLCanvasElement>()
const labelEls = new Map<string, HTMLElement>()
const sites = ref<Site[]>([])
const hovered = ref<Site | null>(null)
const tip = ref({ x: 0, y: 0 })
const scrollP = ref(0)
const dockW = ref(0)
const webglFailed = ref(false)

// ---------- 停靠：页面上带 data-globe-slot 的元素为地球预留位置 ----------

let slotEl: HTMLElement | null = null

function dockProvider() {
    if (!slotEl || !slotEl.isConnected) slotEl = document.querySelector<HTMLElement>('[data-globe-slot]')
    if (!slotEl) return null
    const r = slotEl.getBoundingClientRect()
    if (r.width === 0) return null
    const H = window.innerHeight
    const cy = r.top + r.height / 2
    // 预留位置越接近视口中央，停靠程度越高
    let w = Math.max(0, 1 - Math.abs(cy - H / 2) / (H * 0.7))
    w = w * w * (3 - 2 * w)
    if (Math.abs(w - dockW.value) > 0.01 || (w === 0 && dockW.value !== 0)) dockW.value = w
    return { cx: r.left + r.width / 2, cy, r: (Math.min(r.width, r.height) / 2) * 0.84, w }
}

let scene: GlobeScene | null = null
let ro: ResizeObserver | null = null
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const siteNodes = (s: Site) => s.ids.map((id) => nodeById.value.get(id)!).filter(Boolean)

// 不显示提供商名：站点以地区命名；同一坐标合并了多个节点时写「Netherlands ×2」
const siteTitle = (s: Site) => {
    const ns = siteNodes(s)
    const regions = [...new Set(ns.map((n) => regionName(n.location?.country_code)))]
    if (regions.length === 1 && regions[0]) return ns.length > 1 ? `${regions[0]} ×${ns.length}` : regions[0]
    return ns.map(labelOf).join(' · ')
}
const siteCountry = (s: Site) => siteNodes(s)[0]?.location?.country_code ?? null

/** 悬停站点：到其他各站的最快 RTT */
const hoverRows = computed(() => {
    const s = hovered.value
    if (!s) return []
    const rows: { label: string; rtt: number | null }[] = []
    for (const other of sites.value) {
        if (other === s) continue
        let best: number | null = null
        for (const a of s.ids)
            for (const b of other.ids) {
                const l = link(a, b)
                if (l?.state === 'ok' && l.rtt_ms !== null) best = best === null ? l.rtt_ms : Math.min(best, l.rtt_ms)
            }
        rows.push({ label: siteTitle(other), rtt: best })
    }
    return rows.sort((x, y) => (x.rtt ?? 1e9) - (y.rtt ?? 1e9)).slice(0, 4)
})

function readTheme() {
    if (!scene || !root.value) return
    const cs = getComputedStyle(root.value)
    const v = (name: string) => cs.getPropertyValue(name).trim()
    scene.setTheme({
        dot: v('--globe-dot'),
        line: v('--globe-line'),
        rim: v('--globe-rim'),
        accent: v('--accent'),
        warn: v('--warn'),
        dark: isDark.value
    })
}

function onFrame(projected: ProjectedSite[]) {
    // 标签避让：按 y 排序，与上一个可见标签水平接近且垂直过近时向下推
    const placed: { x: number; y: number }[] = []
    const sorted = [...projected].sort((a, b) => a.y - b.y)
    // 直接写 DOM，避免每帧触发 Vue 响应式更新
    for (const p of sorted) {
        const el = labelEls.get(p.key)
        if (!el) continue
        const visible = p.facing > 0.18
        let ly = p.y
        if (visible) {
            for (const q of placed) {
                if (Math.abs(q.x - p.x) < 150 && ly - q.y < 16) ly = q.y + 16
            }
            placed.push({ x: p.x, y: ly })
        }
        el.style.transform = `translate3d(${p.x}px, ${ly}px, 0)`
        el.style.setProperty('--lead', `${ly - p.y}px`)
        el.style.opacity = visible ? String(Math.min(1, (p.facing - 0.18) * 4)) : '0'
    }
    if (hovered.value) {
        const p = projected.find((x) => x.key === hovered.value!.key)
        if (p) tip.value = { x: p.x, y: p.y }
    }
}

// ---------- 拖拽与悬停 ----------

let dragging = false
let lastX = 0
let lastY = 0

function localPoint(e: PointerEvent) {
    const r = canvas.value!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
}

function onPointerDown(e: PointerEvent) {
    if (!scene || !interactive.value) return
    dragging = true
    lastX = e.clientX
    lastY = e.clientY
    scene.setDragging(true)
    canvas.value!.setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
    if (!scene) return
    if (dragging) {
        scene.drag(e.clientX - lastX, e.clientY - lastY)
        lastX = e.clientX
        lastY = e.clientY
        return
    }
    if (e.pointerType !== 'mouse') return
    const { x, y } = localPoint(e)
    const site = scene.pick(x, y)
    if (site !== hovered.value) {
        hovered.value = site
        focus.value = site ? { kind: 'node', id: site.ids[0] } : null
    }
}

function onPointerUp(e: PointerEvent) {
    dragging = false
    scene?.setDragging(false)
    canvas.value?.releasePointerCapture?.(e.pointerId)
}

function onPointerLeave() {
    if (hovered.value) {
        hovered.value = null
        focus.value = null
    }
}

// ---------- 滚动编排 ----------

function onScroll() {
    const p = Math.min(1, window.scrollY / (window.innerHeight * 0.85))
    scrollP.value = p
    scene?.setScroll(p)
}

function onVisibility() {
    if (document.hidden) scene?.stop()
    else scene?.start()
}

function setLabelRef(key: string, el: unknown) {
    if (el instanceof HTMLElement) labelEls.set(key, el)
    else labelEls.delete(key)
}

onMounted(() => {
    if (!canvas.value || !root.value) return
    try {
        scene = new GlobeScene(canvas.value, reduced)
    } catch (err) {
        console.warn('WebGL unavailable, globe disabled:', err)
        webglFailed.value = true
        return
    }
    scene.onFrame = onFrame
    scene.dockProvider = dockProvider
    readTheme()

    ro = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect
        scene?.resize(width, height)
    })
    ro.observe(root.value)

    if (snapshot.value) {
        scene.setData(snapshot.value.nodes, link)
        sites.value = scene.getSites()
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    scene.start()
})

onUnmounted(() => {
    window.removeEventListener('scroll', onScroll)
    document.removeEventListener('visibilitychange', onVisibility)
    ro?.disconnect()
    scene?.dispose()
    scene = null
})

watch(snapshot, (snap) => {
    if (!scene || !snap) return
    scene.setData(snap.nodes, link)
    sites.value = scene.getSites()
    scene.setFocus(focus.value)
})

watch(focus, (f) => scene?.setFocus(f))

watch(isDark, () => nextTick(readTheme))

/** 进入正文后地球作为背景变暗；停靠到预留位置时恢复完整亮度 */
const canvasOpacity = computed(() => {
    const bg = 1 - 0.7 * scrollP.value
    return bg + (1 - bg) * dockW.value
})

/** 首屏或停靠时可拖拽、悬停 */
const interactive = computed(() => scrollP.value < 0.6 || dockW.value > 0.5)

const labelOpacity = computed(() => Math.max(0, 1 - scrollP.value * 2.2, dockW.value))
</script>

<template>
    <div
        ref="root"
        class="globe-root"
        :class="{ 'is-bg': !interactive }"
        :style="{ '--globe-opacity': canvasOpacity }"
        aria-hidden="true"
    >
        <canvas
            v-if="!webglFailed"
            ref="canvas"
            class="globe-canvas"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
            @pointerleave="onPointerLeave"
        />

        <div class="labels" :style="{ opacity: labelOpacity }">
            <div
                v-for="s in sites"
                :key="s.key"
                :ref="(el) => setLabelRef(s.key, el)"
                class="site-label"
                :class="{ 'is-warn': s.state !== 'online', 'is-hover': hovered?.key === s.key }"
            >
                <CountryFlag :code="siteCountry(s)" :size="12" />
                <span class="sl-name">{{ siteTitle(s) }}</span>
            </div>
        </div>

        <transition name="tip">
            <div
                v-if="hovered"
                class="globe-tip"
                :style="{ transform: `translate3d(${tip.x}px, ${tip.y}px, 0)` }"
            >
                <div class="tip-head">
                    <CountryFlag :code="siteCountry(hovered)" :size="16" />
                    <span class="tip-name">{{ siteTitle(hovered) }}</span>
                </div>
                <div v-for="r in hoverRows" :key="r.label" class="tip-row">
                    <span>→ {{ r.label }}</span>
                    <b>{{ r.rtt === null ? 'n/a' : `${r.rtt.toFixed(1)} ms` }}</b>
                </div>
            </div>
        </transition>
    </div>
</template>

<style scoped lang="scss">
.globe-root {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
}

.globe-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    pointer-events: auto;
    cursor: grab;
    touch-action: pan-y; /* 竖向滑动仍可滚动页面 */
    opacity: var(--globe-opacity, 1);
    transition: opacity 0.25s linear;
    animation: globe-in 1.6s var(--ease) both;

    &:active {
        cursor: grabbing;
    }
}

.is-bg .globe-canvas {
    pointer-events: none;
}

@keyframes globe-in {
    from {
        opacity: 0;
    }
}

.labels {
    position: absolute;
    inset: 0;
    transition: opacity 0.3s;
}

.site-label {
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    padding-left: 14px;
    margin-top: -8px;
    font-family: var(--font-mono);
    font-size: 10.5px;
    letter-spacing: 0.04em;
    white-space: nowrap;
    color: var(--text-2);
    will-change: transform, opacity;
    transition: color 0.2s;

    /* 引线：被避让推开的标签连回站点 */
    &::before {
        content: '';
        position: absolute;
        left: 3px;
        top: calc(8px - var(--lead, 0px));
        width: 1px;
        height: var(--lead, 0px);
        background: var(--line-2);
    }

    &::after {
        content: '';
        position: absolute;
        left: 3px;
        top: 8px;
        width: 8px;
        height: 1px;
        background: var(--line-2);
    }

    &.is-hover {
        color: var(--text);
    }

    &.is-warn .sl-name {
        color: var(--warn);
    }
}


.globe-tip {
    position: absolute;
    top: 0;
    left: 0;
    margin: 18px 0 0 18px;
    min-width: 220px;
    padding: 12px 14px;
    background: var(--panel);
    border: 1px solid var(--line-2);
    border-radius: 10px;
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    font-size: 12px;
    pointer-events: none;
}

.tip-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 8px;
    margin-bottom: 6px;
    border-bottom: 1px solid var(--line);
}

.tip-name {
    font-weight: 600;
}

.tip-row span {
    color: var(--text-2);
}

.tip-row {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    line-height: 1.9;
    font-family: var(--font-mono);
    font-size: 11px;

    b {
        font-weight: 500;
    }
}

.tip-enter-active,
.tip-leave-active {
    transition: opacity 0.18s;
}

.tip-enter-from,
.tip-leave-to {
    opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
    .globe-canvas {
        animation: none;
        transition: none;
    }
}
</style>
