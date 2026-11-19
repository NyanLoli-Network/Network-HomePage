import {
    AdditiveBlending,
    BackSide,
    BufferAttribute,
    BufferGeometry,
    Color,
    Group,
    Line,
    Mesh,
    MeshBasicMaterial,
    NormalBlending,
    PerspectiveCamera,
    Points,
    Scene,
    ShaderMaterial,
    SphereGeometry,
    Vector3,
    WebGLRenderer
} from 'three'
import type { Focus, LatencyLink, LatencyNode } from '@/types/latency'
import { buildLandDots } from './landDots'

const DEG = Math.PI / 180

export interface GlobeTheme {
    dot: string
    accent: string
    line: string
    warn: string
    rim: string
    dark: boolean
}

export interface ProjectedSite {
    key: string
    x: number
    y: number
    facing: number
}

/** 同一坐标上的节点合并为一个站点（API 坐标是国家代表点，常有重叠） */
export interface Site {
    key: string
    ids: string[]
    pos: Vector3
    state: 'online' | 'degraded' | 'offline'
}

interface ArcEntry {
    a: Site
    b: Site
    mesh: Line<BufferGeometry, ShaderMaterial>
}

const toVec = (lat: number, lng: number, r = 1) => {
    const φ = lat * DEG
    const λ = lng * DEG
    return new Vector3(Math.cos(φ) * Math.sin(λ) * r, Math.sin(φ) * r, Math.cos(φ) * Math.cos(λ) * r)
}

/** RTT → 包在弧线上走完一趟的频率（次/秒）：延迟越低，跑得越快 */
const speedFor = (rtt: number | null) => (rtt === null ? 0 : Math.min(0.9, Math.max(0.09, 14 / rtt)))

// ---------------------------------------------------------------- shaders

const dotVert = /* glsl */ `
    uniform float uSize;
    uniform float uTime;
    attribute float aSeed;
    varying float vAlpha;
    void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vec3 center = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec3 n = normalize(world.xyz - center);
        vec3 v = normalize(cameraPosition - world.xyz);
        float facing = dot(n, v);
        float twinkle = 0.82 + 0.18 * sin(uTime * 0.8 + aSeed * 6.2831);
        vAlpha = smoothstep(0.0, 0.55, facing) * twinkle;
        vec4 mv = viewMatrix * world;
        gl_PointSize = uSize * (4.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
    }
`

const dotFrag = /* glsl */ `
    uniform vec3 uColor;
    uniform float uOpacity;
    varying float vAlpha;
    void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.2, d) * vAlpha * uOpacity;
        gl_FragColor = vec4(uColor, a);
    }
`

const arcVert = /* glsl */ `
    attribute float aT;
    varying float vT;
    void main() {
        vT = aT;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`

const arcFrag = /* glsl */ `
    uniform float uTime;
    uniform vec3 uLine;
    uniform vec3 uAccent;
    uniform vec3 uWarn;
    uniform float uSpeedAB;
    uniform float uSpeedBA;
    uniform float uOffset;
    uniform float uFocus;
    uniform float uDim;
    uniform float uDown;
    uniform float uMotion;
    varying float vT;

    float trail(float head, float t) {
        float d = head - t;
        return (d > 0.0 && d < 0.14) ? pow(1.0 - d / 0.14, 2.2) : 0.0;
    }

    void main() {
        // 断开的方向用虚线 + 警示色
        if (uDown > 0.5) {
            if (fract(vT * 70.0) > 0.45) discard;
            gl_FragColor = vec4(uWarn, 0.55);
            return;
        }
        float t = uTime * uMotion;
        float ab = uSpeedAB > 0.0 ? trail(fract(t * uSpeedAB + uOffset), vT) : 0.0;
        float ba = uSpeedBA > 0.0 ? trail(fract(t * uSpeedBA + uOffset + 0.5), 1.0 - vT) : 0.0;
        float pkt = clamp(ab + ba, 0.0, 1.0);
        float ends = smoothstep(0.0, 0.06, vT) * smoothstep(1.0, 0.94, vT);
        float base = mix(0.3, 0.06, uDim) + uFocus * 0.6;
        float a = (base + pkt * mix(0.85, 0.2, uDim) * (1.0 - uFocus * 0.3)) * ends;
        vec3 col = mix(uLine, uAccent, clamp(pkt + uFocus, 0.0, 1.0));
        gl_FragColor = vec4(col, a);
    }
`

const siteVert = /* glsl */ `
    attribute float aState;
    attribute float aFocus;
    attribute float aSeed;
    varying float vState;
    varying float vFocus;
    varying float vSeed;
    varying float vFacing;
    void main() {
        vState = aState;
        vFocus = aFocus;
        vSeed = aSeed;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vec3 center = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vFacing = dot(normalize(world.xyz - center), normalize(cameraPosition - world.xyz));
        gl_PointSize = mix(46.0, 72.0, aFocus);
        gl_Position = projectionMatrix * viewMatrix * world;
    }
`

const siteFrag = /* glsl */ `
    uniform float uTime;
    uniform float uMotion;
    uniform vec3 uAccent;
    uniform vec3 uWarn;
    varying float vState;
    varying float vFocus;
    varying float vSeed;
    varying float vFacing;
    void main() {
        if (vFacing < 0.0) discard;
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c) * 2.0;
        vec3 col = vState > 0.5 ? uWarn : uAccent;
        float core = smoothstep(0.17, 0.12, d);
        float halo = smoothstep(0.42, 0.12, d) * 0.22;
        float ring = 0.0;
        if (vState < 1.5) {
            float r = fract(uTime * uMotion * 0.45 + vSeed);
            float rr = mix(0.18, 1.0, r);
            ring = smoothstep(0.05, 0.0, abs(d - rr)) * (1.0 - r) * 0.9;
        }
        float focusRing = vFocus * smoothstep(0.04, 0.0, abs(d - 0.42)) * 0.9;
        float a = (core + halo + ring + focusRing) * smoothstep(0.0, 0.25, vFacing);
        if (a < 0.01) discard;
        gl_FragColor = vec4(col, a);
    }
`

const starVert = /* glsl */ `
    uniform float uPixelRatio;
    uniform float uTime;
    attribute float aSeed;
    varying float vAlpha;
    void main() {
        vAlpha = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (0.4 + aSeed) + aSeed * 40.0));
        gl_PointSize = (0.6 + aSeed * 1.6) * uPixelRatio;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`

const starFrag = /* glsl */ `
    uniform vec3 uColor;
    uniform float uOpacity;
    varying float vAlpha;
    void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        gl_FragColor = vec4(uColor, smoothstep(0.5, 0.0, d) * vAlpha * uOpacity);
    }
`

const rimVert = /* glsl */ `
    varying vec3 vN;
    varying vec3 vV;
    void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - world.xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
    }
`

const rimFrag = /* glsl */ `
    uniform vec3 uColor;
    uniform float uStrength;
    varying vec3 vN;
    varying vec3 vV;
    void main() {
        // 背面球壳：越靠近地球轮廓越亮，向外迅速衰减 —— 一圈很淡的空气感
        float d = abs(dot(vN, vV));
        float f = smoothstep(0.0, 0.55, d) * pow(1.0 - d, 2.0);
        gl_FragColor = vec4(uColor, f * uStrength);
    }
`

// ---------------------------------------------------------------- scene

export class GlobeScene {
    private renderer: WebGLRenderer
    private scene = new Scene()
    private camera = new PerspectiveCamera(30, 1, 0.1, 100)
    private globe = new Group()
    private arcsGroup = new Group()
    private dots: Points<BufferGeometry, ShaderMaterial>
    private rim: Mesh<SphereGeometry, ShaderMaterial>
    private stars: Points<BufferGeometry, ShaderMaterial>
    private sitePoints: Points<BufferGeometry, ShaderMaterial> | null = null

    private sites: Site[] = []
    private siteOf = new Map<string, Site>()
    private arcs: ArcEntry[] = []
    private theme: GlobeTheme | null = null

    private width = 1
    private height = 1
    private raf = 0
    private running = false
    private last = 0
    private time = 0
    private motion: number

    // 旋转状态：自转 + 拖拽惯性 + 聚焦时转向目标
    private rotY = 40 * DEG
    private rotX = 16 * DEG
    private velY = 0
    private velX = 0
    private target: { y: number; x: number } | null = null
    private dragging = false

    /** 0 = 首屏（地球在右侧），1 = 正文背景（居中放大、变暗） */
    private scroll = 0
    private compact = false

    onFrame: ((sites: ProjectedSite[]) => void) | null = null

    /** 每帧询问停靠位置（canvas 像素）；w 为 0–1 的停靠程度 */
    dockProvider: (() => { cx: number; cy: number; r: number; w: number } | null) | null = null

    constructor(canvas: HTMLCanvasElement, reducedMotion: boolean) {
        this.motion = reducedMotion ? 0 : 1
        this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' })
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        this.renderer.setClearColor(0x000000, 0)

        this.camera.position.set(0, 0, 4.6)
        this.scene.add(this.globe)

        // 仅写深度的遮挡球：让背面的弧线和点被正确遮住，又不覆盖页面底色
        const occluder = new Mesh(
            new SphereGeometry(0.985, 64, 64),
            new MeshBasicMaterial({ colorWrite: false })
        )
        occluder.renderOrder = 0
        this.globe.add(occluder)

        // 陆地点阵
        const positions = buildLandDots()
        const seeds = new Float32Array(positions.length / 3).map(() => Math.random())
        const dotGeo = new BufferGeometry()
        dotGeo.setAttribute('position', new BufferAttribute(positions, 3))
        dotGeo.setAttribute('aSeed', new BufferAttribute(seeds, 1))
        this.dots = new Points(
            dotGeo,
            new ShaderMaterial({
                vertexShader: dotVert,
                fragmentShader: dotFrag,
                uniforms: {
                    uColor: { value: new Color() },
                    uSize: { value: 2.4 * this.renderer.getPixelRatio() },
                    uTime: { value: 0 },
                    uOpacity: { value: 0.9 }
                },
                transparent: true,
                depthWrite: false
            })
        )
        this.dots.renderOrder = 1
        this.globe.add(this.dots)

        // 大气边缘
        this.rim = new Mesh(
            new SphereGeometry(1.06, 64, 64),
            new ShaderMaterial({
                vertexShader: rimVert,
                fragmentShader: rimFrag,
                uniforms: { uColor: { value: new Color() }, uStrength: { value: 0.5 } },
                side: BackSide,
                transparent: true,
                depthWrite: false,
                blending: AdditiveBlending
            })
        )
        this.scene.add(this.rim)

        this.arcsGroup.renderOrder = 2
        this.globe.add(this.arcsGroup)

        // 星空（仅深色主题可见）
        const STARS = 1600
        const starPos = new Float32Array(STARS * 3)
        const starSeed = new Float32Array(STARS)
        const v = new Vector3()
        for (let i = 0; i < STARS; i++) {
            v.randomDirection().multiplyScalar(22 + Math.random() * 14)
            v.toArray(starPos, i * 3)
            starSeed[i] = Math.random()
        }
        const starGeo = new BufferGeometry()
        starGeo.setAttribute('position', new BufferAttribute(starPos, 3))
        starGeo.setAttribute('aSeed', new BufferAttribute(starSeed, 1))
        this.stars = new Points(
            starGeo,
            new ShaderMaterial({
                vertexShader: starVert,
                fragmentShader: starFrag,
                uniforms: {
                    uColor: { value: new Color() },
                    uOpacity: { value: 0 },
                    uTime: { value: 0 },
                    uPixelRatio: { value: this.renderer.getPixelRatio() }
                },
                transparent: true,
                depthWrite: false
            })
        )
        this.scene.add(this.stars)
    }

    // ------------------------------------------------ public API

    setTheme(theme: GlobeTheme) {
        this.theme = theme
        this.dots.material.uniforms.uColor.value.set(theme.dot)
        this.dots.material.uniforms.uOpacity.value = theme.dark ? 0.85 : 0.75
        this.rim.material.uniforms.uColor.value.set(theme.rim)
        this.rim.material.uniforms.uStrength.value = theme.dark ? 0.22 : 0.0
        this.rim.material.blending = theme.dark ? AdditiveBlending : NormalBlending
        this.stars.material.uniforms.uColor.value.set(theme.dot)
        this.stars.material.uniforms.uOpacity.value = theme.dark ? 0.75 : 0
        this.arcs.forEach(({ mesh }) => this.paintArc(mesh.material))
        if (this.sitePoints) this.paintSites(this.sitePoints.material)
    }

    setData(nodes: LatencyNode[], link: (s: string, t: string) => LatencyLink | undefined) {
        this.clearData()

        // 1. 合并同坐标节点
        const byKey = new Map<string, Site>()
        for (const n of nodes) {
            if (!n.location) continue // 无坐标的节点不标点，但仍保留在列表与矩阵中
            const key = `${n.location.latitude.toFixed(2)},${n.location.longitude.toFixed(2)}`
            let site = byKey.get(key)
            if (!site) {
                site = { key, ids: [], pos: toVec(n.location.latitude, n.location.longitude, 1.005), state: 'online' }
                byKey.set(key, site)
            }
            site.ids.push(n.id)
            this.siteOf.set(n.id, site)
        }
        this.sites = [...byKey.values()]
        for (const site of this.sites) {
            const states = site.ids.map((id) => nodes.find((n) => n.id === id)!.state)
            site.state = states.every((s) => s === 'online')
                ? 'online'
                : states.some((s) => s === 'online')
                  ? 'degraded'
                  : 'offline'
        }

        // 2. 站点之间的弧线；同一对站点的多条测量取最优 RTT
        const best = (from: Site, to: Site) => {
            let rtt: number | null = null
            let any = false
            for (const s of from.ids)
                for (const t of to.ids) {
                    const l = link(s, t)
                    if (!l) continue
                    any = true
                    if (l.state === 'ok' && l.rtt_ms !== null) rtt = rtt === null ? l.rtt_ms : Math.min(rtt, l.rtt_ms)
                }
            return { rtt, any }
        }

        for (let i = 0; i < this.sites.length; i++) {
            for (let j = i + 1; j < this.sites.length; j++) {
                const a = this.sites[i]
                const b = this.sites[j]
                const ab = best(a, b)
                const ba = best(b, a)
                if (!ab.any && !ba.any) continue
                this.arcs.push({ a, b, mesh: this.buildArc(a, b, ab.rtt, ba.rtt) })
            }
        }
        this.arcs.forEach(({ mesh }) => this.arcsGroup.add(mesh))

        // 3. 站点信标
        const geo = new BufferGeometry()
        geo.setAttribute('position', new BufferAttribute(new Float32Array(this.sites.flatMap((s) => s.pos.toArray())), 3))
        geo.setAttribute('aState', new BufferAttribute(new Float32Array(this.sites.map((s) => (s.state === 'online' ? 0 : s.state === 'degraded' ? 1 : 2))), 1))
        geo.setAttribute('aFocus', new BufferAttribute(new Float32Array(this.sites.length), 1))
        geo.setAttribute('aSeed', new BufferAttribute(new Float32Array(this.sites.map(() => Math.random())), 1))
        this.sitePoints = new Points(
            geo,
            new ShaderMaterial({
                vertexShader: siteVert,
                fragmentShader: siteFrag,
                uniforms: {
                    uTime: { value: 0 },
                    uMotion: { value: this.motion },
                    uAccent: { value: new Color() },
                    uWarn: { value: new Color() }
                },
                transparent: true,
                depthWrite: false
            })
        )
        this.sitePoints.renderOrder = 3
        this.paintSites(this.sitePoints.material)
        this.globe.add(this.sitePoints)
    }

    getSites() {
        return this.sites
    }

    setFocus(focus: Focus) {
        let siteKeys: string[] = []
        let pairSites: [Site, Site] | null = null
        if (focus?.kind === 'node') {
            const s = this.siteOf.get(focus.id)
            if (s) siteKeys = [s.key]
        } else if (focus?.kind === 'pair') {
            const a = this.siteOf.get(focus.a)
            const b = this.siteOf.get(focus.b)
            if (a && b) {
                siteKeys = [a.key, b.key]
                if (a !== b) pairSites = [a, b]
            }
        }

        for (const { a, b, mesh } of this.arcs) {
            const u = mesh.material.uniforms
            const on = pairSites
                ? (a === pairSites[0] && b === pairSites[1]) || (a === pairSites[1] && b === pairSites[0])
                : siteKeys.length === 1 && (a.key === siteKeys[0] || b.key === siteKeys[0])
            u.uFocus.value = on ? 1 : 0
            u.uDim.value = focus && !on ? 1 : 0
        }

        if (this.sitePoints) {
            const attr = this.sitePoints.geometry.getAttribute('aFocus') as BufferAttribute
            this.sites.forEach((s, i) => attr.setX(i, siteKeys.includes(s.key) ? 1 : 0))
            attr.needsUpdate = true
        }

        // 转向焦点（两点时取中点）。仅矩阵选中路径时转向：首屏球心在画面外，
        // 悬停单个站点时若转向，站点反而会被转出视野
        const pts = siteKeys.map((k) => this.sites.find((s) => s.key === k)!.pos)
        if (pts.length && focus?.kind === 'pair') {
            const mid = pts.reduce((acc, p) => acc.add(p), new Vector3()).normalize()
            const lat = Math.asin(mid.y)
            const lng = Math.atan2(mid.x, mid.z)
            this.target = { y: this.nearestAngle(-lng, this.rotY), x: Math.max(-0.6, Math.min(0.9, lat)) }
        } else if (focus?.kind !== 'node') {
            this.target = null
        }
    }

    setScroll(p: number) {
        this.scroll = Math.max(0, Math.min(1, p))
    }

    /** 拖拽：dx/dy 为像素增量 */
    drag(dx: number, dy: number) {
        this.target = null
        this.velY = dx * 0.005
        this.velX = dy * 0.004
        this.rotY += this.velY
        this.rotX = Math.max(-0.9, Math.min(1.1, this.rotX + this.velX))
    }

    setDragging(v: boolean) {
        this.dragging = v
    }

    /** 屏幕坐标（canvas 像素）附近最近的可见站点 */
    pick(x: number, y: number, radius = 22): Site | null {
        let found: Site | null = null
        let bestD = radius
        for (const p of this.project()) {
            if (p.facing < 0.15) continue
            const d = Math.hypot(p.x - x, p.y - y)
            if (d < bestD) {
                bestD = d
                found = this.sites.find((s) => s.key === p.key) ?? null
            }
        }
        return found
    }

    resize(w: number, h: number) {
        this.width = w
        this.height = h
        this.compact = w / h < 0.9
        this.renderer.setSize(w, h, false)
        this.camera.aspect = w / h
        this.camera.updateProjectionMatrix()
    }

    start() {
        if (this.running) return
        this.running = true
        this.last = performance.now()
        const loop = (t: number) => {
            if (!this.running) return
            this.frame(Math.min(0.05, (t - this.last) / 1000))
            this.last = t
            this.raf = requestAnimationFrame(loop)
        }
        this.raf = requestAnimationFrame(loop)
    }

    stop() {
        this.running = false
        cancelAnimationFrame(this.raf)
    }

    dispose() {
        this.stop()
        this.clearData()
        this.dots.geometry.dispose()
        this.dots.material.dispose()
        this.rim.geometry.dispose()
        this.rim.material.dispose()
        this.stars.geometry.dispose()
        this.stars.material.dispose()
        this.renderer.dispose()
    }

    // ------------------------------------------------ internals

    private frame(dt: number) {
        this.time += dt

        // 旋转
        if (this.target) {
            const k = 1 - Math.pow(0.02, dt)
            this.rotY += (this.target.y - this.rotY) * k
            this.rotX += (this.target.x - this.rotX) * k
        } else if (!this.dragging) {
            this.velY *= Math.pow(0.05, dt)
            this.velX *= Math.pow(0.05, dt)
            this.rotY += this.velY - 0.035 * dt * this.motion
            this.rotX = Math.max(-0.9, Math.min(1.1, this.rotX + this.velX))
        }
        this.globe.rotation.set(this.rotX, this.rotY, 0)

        // 滚动编排：首屏地球从画面底部「升起」→ 正文中居中、放大、作为背景
        // 用 view offset 平移画面而非移动地球：透视始终正对球心，朝向计算保持准确
        const e = this.scroll * this.scroll * (3 - 2 * this.scroll)
        const W = this.width
        const H = this.height
        const visH = 2 * this.camera.position.z * Math.tan((this.camera.fov / 2) * DEG)
        const pxPerUnit = H / visH
        const heroR = this.compact ? Math.min(W * 0.7, H * 0.42) : Math.min(W * 0.34, H * 0.62)
        const heroCY = H * (this.compact ? 0.6 : 0.58) + heroR
        const bgR = Math.max(W, H) * 0.42
        let R = heroR + (bgR - heroR) * e
        let cy = heroCY + (H * 0.5 - heroCY) * e
        let cx = W / 2

        // 停靠：页面中某个区块（如延迟矩阵旁）预留了位置时，地球移入该位置并完整显示
        const dock = this.dockProvider?.()
        if (dock && dock.w > 0) {
            R += (dock.r - R) * dock.w
            cy += (dock.cy - cy) * dock.w
            cx += (dock.cx - cx) * dock.w
        }

        // 透视下球的投影半径略大于 s/距离，乘 0.92 补偿
        const s = (R / pxPerUnit) * 0.92
        this.globe.scale.setScalar(s)
        this.rim.scale.setScalar(s)
        this.camera.setViewOffset(W, H, -(cx - W / 2), -(cy - H / 2), W, H)

        this.stars.rotation.y = this.rotY * 0.08
        this.stars.material.uniforms.uTime.value = this.time * this.motion

        this.dots.material.uniforms.uTime.value = this.time * this.motion
        for (const { mesh } of this.arcs) mesh.material.uniforms.uTime.value = this.time
        if (this.sitePoints) this.sitePoints.material.uniforms.uTime.value = this.time

        this.renderer.render(this.scene, this.camera)
        this.onFrame?.(this.project())
    }

    private project(): ProjectedSite[] {
        const out: ProjectedSite[] = []
        const center = this.globe.position
        const tmp = new Vector3()
        for (const site of this.sites) {
            tmp.copy(site.pos).applyMatrix4(this.globe.matrixWorld)
            const n = tmp.clone().sub(center).normalize()
            const v = this.camera.position.clone().sub(tmp).normalize()
            const facing = n.dot(v)
            tmp.project(this.camera)
            out.push({
                key: site.key,
                x: (tmp.x * 0.5 + 0.5) * this.width,
                y: (-tmp.y * 0.5 + 0.5) * this.height,
                facing
            })
        }
        return out
    }

    private buildArc(a: Site, b: Site, rttAB: number | null, rttBA: number | null) {
        const va = a.pos.clone().normalize()
        const vb = b.pos.clone().normalize()
        const ω = Math.acos(Math.min(1, Math.max(-1, va.dot(vb))))
        const lift = 0.03 + 0.34 * (ω / Math.PI)
        const N = 96
        const pos = new Float32Array((N + 1) * 3)
        const ts = new Float32Array(N + 1)
        const p = new Vector3()
        for (let i = 0; i <= N; i++) {
            const t = i / N
            const sa = Math.sin((1 - t) * ω) / Math.sin(ω)
            const sb = Math.sin(t * ω) / Math.sin(ω)
            p.copy(va).multiplyScalar(sa).addScaledVector(vb, sb)
            p.multiplyScalar(1.005 + lift * Math.sin(Math.PI * t))
            p.toArray(pos, i * 3)
            ts[i] = t
        }
        const geo = new BufferGeometry()
        geo.setAttribute('position', new BufferAttribute(pos, 3))
        geo.setAttribute('aT', new BufferAttribute(ts, 1))
        const mat = new ShaderMaterial({
            vertexShader: arcVert,
            fragmentShader: arcFrag,
            uniforms: {
                uTime: { value: 0 },
                uLine: { value: new Color() },
                uAccent: { value: new Color() },
                uWarn: { value: new Color() },
                uSpeedAB: { value: speedFor(rttAB) },
                uSpeedBA: { value: speedFor(rttBA) },
                uOffset: { value: Math.random() },
                uFocus: { value: 0 },
                uDim: { value: 0 },
                uDown: { value: rttAB === null && rttBA === null ? 1 : 0 },
                uMotion: { value: this.motion }
            },
            transparent: true,
            depthWrite: false
        })
        this.paintArc(mat)
        return new Line(geo, mat)
    }

    private paintArc(mat: ShaderMaterial) {
        if (!this.theme) return
        mat.uniforms.uLine.value.set(this.theme.line)
        mat.uniforms.uAccent.value.set(this.theme.accent)
        mat.uniforms.uWarn.value.set(this.theme.warn)
    }

    private paintSites(mat: ShaderMaterial) {
        if (!this.theme) return
        mat.uniforms.uAccent.value.set(this.theme.accent)
        mat.uniforms.uWarn.value.set(this.theme.warn)
    }

    private clearData() {
        for (const { mesh } of this.arcs) {
            this.arcsGroup.remove(mesh)
            mesh.geometry.dispose()
            mesh.material.dispose()
        }
        this.arcs = []
        if (this.sitePoints) {
            this.globe.remove(this.sitePoints)
            this.sitePoints.geometry.dispose()
            this.sitePoints.material.dispose()
            this.sitePoints = null
        }
        this.sites = []
        this.siteOf.clear()
    }

    /** 选取与当前角度最近的等价角，避免转向时绕远路 */
    private nearestAngle(target: number, current: number) {
        const TAU = Math.PI * 2
        return target + Math.round((current - target) / TAU) * TAU
    }
}
