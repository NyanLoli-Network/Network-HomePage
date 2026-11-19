import type { Component } from 'vue'

/**
 * circle-flags-ui（@sankyu/vue-circle-flags）的按需加载。
 *
 * 节点国家来自 API，运行时才知道；官方的 DynamicFlag 会打包全部 400+ 面旗（约 600 KB），
 * 这里改为每面旗一个懒加载 chunk（每个约 1 KB），只下载实际出现的国家。
 */
const loaders = import.meta.glob<Record<string, Component>>(
    '/node_modules/@sankyu/vue-circle-flags/dist/flags/*.mjs'
)

const cache = new Map<string, Component>()
const pending = new Map<string, Promise<Component | null>>()

/** 旗帜替换：左侧地区码显示为右侧地区的旗帜 */
const FLAG_ALIASES: Record<string, string> = {
    tw: 'cn'
}

const normalize = (code: string) => {
    const key = code.toLowerCase()
    return FLAG_ALIASES[key] ?? key
}

const pathOf = (code: string) => `/node_modules/@sankyu/vue-circle-flags/dist/flags/${code}.mjs`

export function hasFlag(code?: string | null): boolean {
    return !!code && pathOf(normalize(code)) in loaders
}

export function cachedFlag(code?: string | null): Component | null {
    return code ? (cache.get(normalize(code)) ?? null) : null
}

export function loadFlag(code?: string | null): Promise<Component | null> {
    if (!code) return Promise.resolve(null)
    const key = normalize(code)
    const hit = cache.get(key)
    if (hit) return Promise.resolve(hit)
    const inflight = pending.get(key)
    if (inflight) return inflight

    const loader = loaders[pathOf(key)]
    if (!loader) return Promise.resolve(null)

    const p = loader()
        .then((mod) => {
            // 每个模块只导出一个组件，如 FlagDe
            const comp = Object.values(mod)[0] ?? null
            if (comp) cache.set(key, comp)
            return comp
        })
        .catch((err) => {
            console.warn(`Failed to load flag "${key}":`, err)
            return null
        })
        .finally(() => pending.delete(key))
    pending.set(key, p)
    return p
}
