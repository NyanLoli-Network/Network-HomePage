<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from 'vuetify'

defineOptions({
    name: 'SiteFooter'
})

const theme = useTheme()
const isDark = computed(() => theme.global.current.value.dark)

interface FooterLink {
    label: string
    to?: string
    href?: string
}

const year = new Date().getFullYear()

const columns: { title: string; links: FooterLink[] }[] = [
    {
        title: 'Network',
        links: [
            { label: 'Live latency', to: '/#latency' },
            { label: 'BGP Communities', to: '/communities' }
        ]
    },
    {
        title: 'Resources',
        links: [
            { label: 'PeeringDB', href: 'https://www.peeringdb.com/net/29458' },
            { label: 'BGP.Tools', href: 'https://bgp.tools/as/207529' },
            { label: 'Looking Glass', href: 'https://bgp.tools/lg/207529' }
        ]
    },
    {
        title: 'Contact',
        links: [
            { label: 'noc@nyanloli.com', href: 'mailto:noc@nyanloli.com' },
            { label: 'Telegram', href: 'https://t.me/Ximineko' }
        ]
    }
]
</script>

<template>
    <footer class="site-footer">
        <div class="container">
            <div class="footer-top">
                <div class="footer-brand">
                    <router-link to="/" class="footer-logo-link" aria-label="NyanLoli Network home">
                        <img
                            src="/logo/logo_dark.svg"
                            alt="NyanLoli Network"
                            class="footer-logo"
                            :class="{ 'is-inverted': isDark }"
                        />
                    </router-link>
                    <p>Non-profit, IPv6-only research &amp; education network.</p>
                </div>
                <div v-for="col in columns" :key="col.title" class="footer-col">
                    <span class="label">{{ col.title }}</span>
                    <ul>
                        <li v-for="link in col.links" :key="link.label">
                            <router-link v-if="link.to" :to="link.to">{{ link.label }}</router-link>
                            <a
                                v-else
                                :href="link.href"
                                :target="link.href?.startsWith('http') ? '_blank' : undefined"
                                rel="noopener"
                                >{{ link.label }}</a
                            >
                        </li>
                    </ul>
                </div>
            </div>
            <div class="footer-bottom mono">
                <span>© {{ year }} NYANLOLI LTD.</span>
                <span>AS207529</span>
            </div>
        </div>
    </footer>
</template>

<style scoped lang="scss">
.site-footer {
    position: relative;
    z-index: 1;
    margin-top: clamp(120px, 14vw, 200px);
    border-top: 1px solid var(--line);
    background: var(--bg);
}

.footer-top {
    display: grid;
    grid-template-columns: 2fr repeat(3, 1fr);
    gap: 32px;
    padding-block: 56px;
}

.footer-logo-link {
    display: inline-block;
}

.footer-logo {
    display: block;
    height: 24px;
    width: auto;

    &.is-inverted {
        filter: invert(1);
    }
}

.footer-brand p {
    margin: 10px 0 0;
    font-size: 14px;
    color: var(--text-2);
}

ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 8px;
}

a {
    font-size: 14px;
    color: var(--text-2);
    text-decoration: none;
    overflow-wrap: anywhere;
    transition: color 0.2s;

    &:hover {
        color: var(--text);
    }
}

.footer-bottom {
    display: flex;
    justify-content: space-between;
    padding-block: 20px 28px;
    border-top: 1px solid var(--line);
    font-size: 11px;
    color: var(--text-3);
    letter-spacing: 0.04em;
}

@media (max-width: 760px) {
    .footer-top {
        grid-template-columns: 1fr 1fr;
    }

    .footer-brand {
        grid-column: 1 / -1;
    }
}
</style>
