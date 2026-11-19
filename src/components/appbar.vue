<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useColorMode } from '@/composables/useColorMode'

defineOptions({
    name: 'AppBarComponent'
})

const { isDark, toggle } = useColorMode()
const route = useRoute()
const menuOpen = ref(false)

const navLinks = [
    { title: 'Mission', url: '/#mission', external: false },
    { title: 'Latency', url: '/#latency', external: false },
    { title: 'Communities', url: '/communities', external: false },
    { title: 'PeeringDB', url: 'https://www.peeringdb.com/net/29458', external: true },
    { title: 'Looking Glass', url: 'https://bgp.tools/lg/207529', external: true }
]

watch(
    () => route.fullPath,
    () => (menuOpen.value = false)
)
</script>

<template>
    <header class="site-header">
        <div class="bar" :class="{ 'is-open': menuOpen }">
            <div class="bar-row">
                <router-link to="/" class="brand" aria-label="NyanLoli Network home">
                    <img
                        src="/logo/logo_dark.svg"
                        alt="NyanLoli Network"
                        class="brand-logo"
                        :class="{ 'is-inverted': isDark }"
                    />
                </router-link>

                <nav class="nav-desktop" aria-label="Main">
                    <template v-for="link in navLinks" :key="link.title">
                        <a v-if="link.external" :href="link.url" target="_blank" rel="noopener" class="nav-link">
                            {{ link.title }}<span class="ext" aria-hidden="true">↗</span>
                        </a>
                        <router-link v-else :to="link.url" class="nav-link">{{ link.title }}</router-link>
                    </template>
                </nav>

                <div class="actions">
                    <button
                        class="icon-btn"
                        type="button"
                        @click="toggle"
                        :aria-label="isDark ? 'Switch to light color mode' : 'Switch to dark color mode'"
                    >
                        <span class="theme-knob" :class="{ 'is-dark': isDark }" />
                    </button>
                    <router-link to="/#join" class="cta">Join</router-link>
                    <button
                        class="icon-btn menu-btn"
                        type="button"
                        @click="menuOpen = !menuOpen"
                        :aria-expanded="menuOpen"
                        aria-controls="mobile-nav"
                        aria-label="Toggle navigation menu"
                    >
                        <span class="burger" :class="{ 'is-open': menuOpen }"><i /><i /></span>
                    </button>
                </div>
            </div>

            <transition name="drop">
                <nav v-if="menuOpen" id="mobile-nav" class="nav-mobile" aria-label="Mobile">
                    <template v-for="link in navLinks" :key="link.title">
                        <a v-if="link.external" :href="link.url" target="_blank" rel="noopener" class="nav-mobile-link">
                            {{ link.title }} <span aria-hidden="true">↗</span>
                        </a>
                        <router-link v-else :to="link.url" class="nav-mobile-link">{{ link.title }}</router-link>
                    </template>
                </nav>
            </transition>
        </div>
    </header>
</template>

<style scoped lang="scss">
.site-header {
    position: sticky;
    top: 0;
    z-index: 1100;
    height: var(--header-h);
    padding: 12px var(--gutter) 0;
    pointer-events: none;
}

/* 悬浮胶囊导航 */
.bar {
    max-width: 980px;
    margin-inline: auto;
    padding: 6px 6px 6px 18px;
    border-radius: 26px;
    background: var(--panel);
    border: 1px solid var(--line);
    backdrop-filter: blur(18px) saturate(140%);
    -webkit-backdrop-filter: blur(18px) saturate(140%);
    pointer-events: auto;
    transition: border-radius 0.3s var(--ease);

    &.is-open {
        border-radius: 20px;
    }
}

.bar-row {
    height: 40px;
    display: flex;
    align-items: center;
    gap: 24px;
}

.brand {
    display: flex;
    align-items: center;
    flex-shrink: 0;
}

.brand-logo {
    height: 17px;
    width: auto;
    display: block;

    &.is-inverted {
        filter: invert(1);
    }
}

.nav-desktop {
    display: flex;
    gap: 4px;
    margin-inline: auto;
}

.nav-link {
    padding: 8px 12px;
    border-radius: 999px;
    font-size: 14px;
    color: var(--text-2);
    text-decoration: none;
    white-space: nowrap;
    transition:
        color 0.2s,
        background-color 0.2s;

    .ext {
        font-size: 11px;
        margin-left: 2px;
        color: var(--text-3);
    }

    &:hover {
        color: var(--text);
        background: var(--line);
    }

    &.router-link-exact-active {
        color: var(--text);
    }
}

.actions {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
}

.icon-btn {
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    transition: background-color 0.2s;

    &:hover {
        background: var(--line);
    }

    &:focus-visible {
        outline: 2px solid var(--accent);
    }
}

/* 月牙/圆：一个圆被背景色圆遮出月牙 */
.theme-knob {
    position: relative;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--text);
    overflow: hidden;
    transition: transform 0.5s var(--ease);

    &::after {
        content: '';
        position: absolute;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--bg);
        top: -4px;
        left: 6px;
        transform: translate(10px, -10px);
        transition: transform 0.5s var(--ease);
    }

    &.is-dark {
        transform: rotate(-30deg);

        &::after {
            transform: none;
        }
    }
}

.cta {
    height: 40px;
    display: inline-flex;
    align-items: center;
    padding: 0 18px;
    border-radius: 999px;
    background: var(--accent);
    color: var(--on-accent);
    font-size: 14px;
    font-weight: 500;
    text-decoration: none;
    transition:
        filter 0.2s,
        transform 0.2s var(--ease);

    &:hover {
        filter: brightness(1.08);
    }

    &:active {
        transform: scale(0.97);
    }
}

.menu-btn {
    display: none;
}

.burger {
    position: relative;
    width: 16px;
    height: 10px;

    i {
        position: absolute;
        left: 0;
        right: 0;
        height: 1.5px;
        border-radius: 1px;
        background: var(--text);
        transition:
            transform 0.3s var(--ease),
            top 0.3s var(--ease);

        &:first-child {
            top: 0;
        }

        &:last-child {
            top: 8.5px;
        }
    }

    &.is-open i:first-child {
        top: 4.25px;
        transform: rotate(45deg);
    }

    &.is-open i:last-child {
        top: 4.25px;
        transform: rotate(-45deg);
    }
}

.nav-mobile {
    display: flex;
    flex-direction: column;
    padding: 8px 12px 12px 0;
}

.nav-mobile-link {
    padding: 12px 0;
    border-top: 1px solid var(--line);
    font-size: 22px;
    font-weight: 300;
    letter-spacing: -0.03em;
    color: var(--text);
    text-decoration: none;
}

.drop-enter-active,
.drop-leave-active {
    transition:
        opacity 0.3s var(--ease),
        transform 0.3s var(--ease);
}

.drop-enter-from,
.drop-leave-to {
    opacity: 0;
    transform: translateY(-6px);
}

@media (max-width: 900px) {
    .nav-desktop {
        display: none;
    }

    .menu-btn {
        display: grid;
    }
}
</style>
