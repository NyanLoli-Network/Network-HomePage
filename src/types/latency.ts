// https://bgp.nyanlo.li/api/public/latency 的响应结构

export type NodeState = 'online' | 'offline' | 'unconfigured'
export type LinkState = 'ok' | 'offline' | 'unconfigured' | 'busy' | 'error'

export interface LatencyNode {
    id: string
    name: string
    state: NodeState
    location: {
        longitude: number
        latitude: number
        country_code?: string
    } | null
}

export interface LatencyLink {
    source_id: string
    target_id: string
    state: LinkState
    /** 往返延迟（ms），仅 state === 'ok' 时有值 */
    rtt_ms: number | null
}

export interface LatencySnapshot {
    measured_at: string
    all_connected: boolean
    nodes: LatencyNode[]
    links: LatencyLink[]
}

/** 双向合并后的节点对 */
export interface NodePair {
    key: string
    a: LatencyNode
    b: LatencyNode
    ab: LatencyLink | undefined
    ba: LatencyLink | undefined
}

export type Focus = { kind: 'node'; id: string } | { kind: 'pair'; a: string; b: string } | null
