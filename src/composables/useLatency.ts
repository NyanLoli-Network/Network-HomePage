import { computed, ref, shallowRef } from 'vue'
import type { Focus, LatencyLink, LatencyNode, LatencySnapshot, NodePair } from '@/types/latency'

const ENDPOINT = 'https://bgp.nyanlo.li/api/public/latency'
/** 文档建议状态页按分钟读取 */
const POLL_MS = 60_000

// ---------- 模块级共享状态（首页 3D 背景、矩阵、统计共用） ----------

const snapshot = shallowRef<LatencySnapshot | null>(null)
const loading = ref(false)
/** 'unavailable' = 503，快照暂不可读；不代表节点离线 */
const error = ref<null | 'unavailable' | 'network'>(null)
const now = ref(Date.now())
const focus = ref<Focus>(null)

let timer: number | undefined
let clock: number | undefined
let consumers = 0

async function fetchSnapshot(): Promise<number> {
    loading.value = true
    try {
        const res = await fetch(ENDPOINT, { headers: { Accept: 'application/json' } })
        if (res.status === 503) {
            error.value = 'unavailable'
            const retry = Number(res.headers.get('Retry-After'))
            return Number.isFinite(retry) && retry > 0 ? retry * 1000 : 5_000
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: LatencySnapshot = await res.json()
        // 仅在有新一轮测量时替换，避免无谓的重绘
        if (data.measured_at !== snapshot.value?.measured_at) snapshot.value = data
        error.value = null
        return POLL_MS
    } catch (err) {
        console.error('Failed to fetch latency snapshot:', err)
        error.value = 'network'
        return POLL_MS
    } finally {
        loading.value = false
    }
}

async function tick() {
    window.clearTimeout(timer)
    if (document.hidden) return // 页面隐藏时暂停，可见时再继续
    const next = await fetchSnapshot()
    timer = window.setTimeout(tick, next)
}

function onVisibility() {
    if (!document.hidden) tick()
}

function start() {
    if (consumers++ > 0) return
    tick()
    clock = window.setInterval(() => (now.value = Date.now()), 15_000)
    document.addEventListener('visibilitychange', onVisibility)
}

function stop() {
    if (--consumers > 0) return
    window.clearTimeout(timer)
    window.clearInterval(clock)
    document.removeEventListener('visibilitychange', onVisibility)
}

// ---------- 派生数据 ----------

const nodes = computed<LatencyNode[]>(() => snapshot.value?.nodes ?? [])

const nodeById = computed(() => new Map(nodes.value.map((n) => [n.id, n])))

const linkMap = computed(() => {
    const m = new Map<string, LatencyLink>()
    snapshot.value?.links.forEach((l) => m.set(`${l.source_id}>${l.target_id}`, l))
    return m
})

const link = (s: string, t: string) => linkMap.value.get(`${s}>${t}`)

// ---------- 节点显示名 ----------
// API 的 name 是提供商名称，页面上不显示；一律以所在地区命名

const REGION_OVERRIDES: Record<string, string> = {
    HK: 'Hong Kong',
    MO: 'Macau',
    US: 'United States',
    GB: 'United Kingdom'
}

const regionNames = (() => {
    try {
        return new Intl.DisplayNames(['en'], { type: 'region' })
    } catch {
        return null
    }
})()

/** ISO 3166-1 两位码 → 英文地区名；未知时返回 null */
export function regionName(cc?: string): string | null {
    if (!cc) return null
    try {
        return REGION_OVERRIDES[cc] ?? regionNames?.of(cc) ?? cc
    } catch {
        return cc
    }
}

/** 同一地区有多个节点时按 id 排序编号（Netherlands 1 / 2），保证每次刷新编号稳定 */
const labels = computed(() => {
    const groups = new Map<string, LatencyNode[]>()
    for (const n of [...nodes.value].sort((a, b) => a.id.localeCompare(b.id))) {
        const key = regionName(n.location?.country_code) ?? 'Node'
        const list = groups.get(key)
        if (list) list.push(n)
        else groups.set(key, [n])
    }
    const m = new Map<string, string>()
    for (const [key, list] of groups) {
        list.forEach((n, i) => m.set(n.id, list.length > 1 || key === 'Node' ? `${key} ${i + 1}` : key))
    }
    return m
})

const labelOf = (n: LatencyNode) => labels.value.get(n.id) ?? 'Node'

const pairs = computed<NodePair[]>(() => {
    const list: NodePair[] = []
    const ns = nodes.value
    for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
            const a = ns[i]
            const b = ns[j]
            list.push({ key: `${a.id}|${b.id}`, a, b, ab: link(a.id, b.id), ba: link(b.id, a.id) })
        }
    }
    return list
})

const okLinks = computed(() =>
    (snapshot.value?.links ?? []).filter((l) => l.state === 'ok' && l.rtt_ms !== null)
)

const stats = computed(() => {
    const links = snapshot.value?.links ?? []
    const rtts = okLinks.value.map((l) => l.rtt_ms!).sort((x, y) => x - y)
    const median = rtts.length
        ? rtts.length % 2
            ? rtts[(rtts.length - 1) / 2]
            : (rtts[rtts.length / 2 - 1] + rtts[rtts.length / 2]) / 2
        : null
    const byRtt = [...okLinks.value].sort((x, y) => x.rtt_ms! - y.rtt_ms!)
    return {
        online: nodes.value.filter((n) => n.state === 'online').length,
        total: nodes.value.length,
        pathsUp: okLinks.value.length,
        pathsTotal: links.length,
        median,
        max: rtts.length ? rtts[rtts.length - 1] : null,
        fastest: byRtt[0] ?? null,
        slowest: byRtt.length ? byRtt[byRtt.length - 1] : null
    }
})

const measuredAgo = computed(() => {
    if (!snapshot.value) return null
    const diff = Math.max(0, now.value - Date.parse(snapshot.value.measured_at))
    const min = Math.round(diff / 60_000)
    if (min < 1) return 'just now'
    if (min < 60) return `${min} min ago`
    const h = Math.floor(min / 60)
    return `${h} h ${min % 60} min ago`
})

// ---------- 几何辅助 ----------

const toRad = (d: number) => (d * Math.PI) / 180

/** 大圆距离（km）。坐标是国家代表点，只能作为近似值 */
export function greatCircleKm(a: LatencyNode, b: LatencyNode): number | null {
    if (!a.location || !b.location) return null
    const φ1 = toRad(a.location.latitude)
    const φ2 = toRad(b.location.latitude)
    const dφ = φ2 - φ1
    const dλ = toRad(b.location.longitude - a.location.longitude)
    const h = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2
    return 2 * 6371 * Math.asin(Math.sqrt(h))
}

export function useLatency() {
    return {
        snapshot,
        loading,
        error,
        focus,
        nodes,
        nodeById,
        pairs,
        stats,
        measuredAgo,
        link,
        labelOf,
        start,
        stop,
        refresh: tick
    }
}
