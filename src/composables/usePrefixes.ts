import { computed, ref } from 'vue'
import { getASPrefixesWithWhois } from '@/hooks/heapi'
import { regionName } from '@/composables/useLatency'

export type PrefixKind = 'site' | 'broadband' | 'anycast' | 'infra' | 'org' | 'unlabelled'

export interface PrefixRow {
    prefix: string
    /** 前缀长度，如 48 */
    length: number
    /** 所属 RIR 分配块，如 2a14:7580::/29 */
    parent: string
    rir: string
    kind: PrefixKind
    /** 站点所在地（ISO 3166-1 两位码），仅 site / broadband 有 */
    cc: string | null
    label: string
}

export interface PrefixGroup {
    parent: string
    rir: string
    rows: PrefixRow[]
}

const RIR_NAMES: Record<string, string> = {
    ripencc: 'RIPE NCC',
    arin: 'ARIN',
    apnic: 'APNIC',
    lacnic: 'LACNIC',
    afrinic: 'AFRINIC'
}

/** WHOIS 里的地区写法 → ISO 码 */
const CC_ALIASES: Record<string, string> = { UK: 'GB' }

/**
 * 从 WHOIS Org 字段解析用途与地点。
 * Org 形如「NyanLoli Network @ JP - Cornseed」，「-」后面是提供商名 —— 页面上不显示，只保留地点。
 */
function describe(org: string | undefined): Pick<PrefixRow, 'kind' | 'cc' | 'label'> {
    const text = (org ?? '').trim()
    if (!text || text === '-') return { kind: 'unlabelled', cc: null, label: 'Unlabelled' }
    if (/anycast/i.test(text)) return { kind: 'anycast', cc: null, label: 'Anycast' }
    if (/\bnoc\b/i.test(text)) return { kind: 'infra', cc: null, label: 'Infrastructure' }

    const at = text.match(/@\s*([^-]+?)\s*(?:-|$)/)
    if (at) {
        const loc = at[1].trim().toUpperCase()
        if (/^[A-Z]{2}$/.test(loc)) {
            const cc = CC_ALIASES[loc] ?? loc
            const broadband = /broadband/i.test(text)
            const place = regionName(cc) ?? cc
            return {
                kind: broadband ? 'broadband' : 'site',
                cc,
                label: broadband ? `${place} · Broadband` : place
            }
        }
        // 非地区码的位置（交换点 / 机房名）同样属于提供商信息，归为基础设施
        return { kind: 'infra', cc: null, label: 'Infrastructure' }
    }
    if (/nyanloli/i.test(text)) return { kind: 'org', cc: null, label: 'NYANLOLI LTD.' }
    return { kind: 'unlabelled', cc: null, label: 'Unlabelled' }
}

const prefixes = ref<PrefixRow[]>([])
const loading = ref(false)
const error = ref('')
let loaded = false

async function fetchPrefixes() {
    loading.value = true
    error.value = ''
    try {
        const data = await getASPrefixesWithWhois(207529)
        prefixes.value = data
            .filter((item) => item.Prefix.includes(':')) // 只展示 IPv6
            .map((item) => ({
                prefix: item.Prefix,
                length: Number(item.Prefix.split('/')[1]) || 128,
                parent: item.RIRData?.Prefix || item.Prefix,
                rir: RIR_NAMES[item.RIRData?.RIR?.toLowerCase()] ?? (item.RIRData?.RIR || 'Unknown').toUpperCase(),
                ...describe(item.Org)
            }))
        loaded = true
    } catch (err) {
        console.error('Failed to fetch IPv6 blocks:', err)
        error.value = 'Failed to load IPv6 blocks'
        prefixes.value = []
    } finally {
        loading.value = false
    }
}

/** 按 RIR 分配块分组，前缀最多的组在前 */
const groups = computed<PrefixGroup[]>(() => {
    const map = new Map<string, PrefixGroup>()
    for (const row of prefixes.value) {
        const g = map.get(row.parent)
        if (g) g.rows.push(row)
        else map.set(row.parent, { parent: row.parent, rir: row.rir, rows: [row] })
    }
    return [...map.values()].sort((a, b) => b.rows.length - a.rows.length || a.parent.localeCompare(b.parent))
})

/** 宣告的地址总量，以 /48 为单位 */
const total48 = computed(() => prefixes.value.reduce((sum, p) => sum + 2 ** (48 - p.length), 0))

/** 共享的 AS207529 IPv6 前缀数据 */
export function usePrefixes() {
    if (!loaded && !loading.value) fetchPrefixes()
    return { prefixes, groups, total48, loading, error, refresh: fetchPrefixes }
}
