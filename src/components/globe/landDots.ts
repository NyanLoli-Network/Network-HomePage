import { feature } from 'topojson-client'
import { geoEquirectangular, geoPath } from 'd3-geo'
import landTopo from 'world-atlas/land-110m.json'

type Topo = Parameters<typeof feature>[0]
type TopoObject = Parameters<typeof feature>[1]

/**
 * 生成落在陆地上的球面点（单位球，x=cosφ·sinλ, y=sinφ, z=cosφ·cosλ）。
 * 先把陆地多边形栅格化到等距圆柱投影的离屏画布，再用 Fibonacci 球面采样逐点查表，
 * 比逐点做多边形包含测试快两个数量级。
 */
export function buildLandDots(samples = 42000): Float32Array {
    const W = 1024
    const H = 512
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!

    const topo = landTopo as unknown as Topo
    const land = feature(topo, (topo.objects as Record<string, TopoObject>).land)
    const projection = geoEquirectangular()
        .scale(W / (2 * Math.PI))
        .translate([W / 2, H / 2])
    ctx.fillStyle = '#000'
    ctx.beginPath()
    geoPath(projection, ctx)(land)
    ctx.fill()

    const mask = ctx.getImageData(0, 0, W, H).data
    const out: number[] = []
    const golden = Math.PI * (3 - Math.sqrt(5))

    for (let i = 0; i < samples; i++) {
        const y = 1 - ((i + 0.5) / samples) * 2
        const r = Math.sqrt(1 - y * y)
        const θ = golden * i
        const x = Math.cos(θ) * r
        const z = Math.sin(θ) * r
        const lat = Math.asin(y)
        const lng = Math.atan2(x, z)
        const px = Math.min(W - 1, Math.floor(((lng + Math.PI) / (2 * Math.PI)) * W))
        const py = Math.min(H - 1, Math.floor(((Math.PI / 2 - lat) / Math.PI) * H))
        if (mask[(py * W + px) * 4 + 3] > 128) out.push(x, y, z)
    }
    return new Float32Array(out)
}
