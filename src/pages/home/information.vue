<script setup lang="ts">
import { usePrefixes } from '@/composables/usePrefixes'

defineOptions({
    name: 'InformationComponent'
})

const { prefixes, loading, error } = usePrefixes()
</script>

<template>
    <section>
        <h3 class="ledger-title">Network</h3>
        <dl class="spec-list">
            <div>
                <dt>ASN</dt>
                <dd class="mono">AS207529</dd>
            </div>
            <div>
                <dt>Operator</dt>
                <dd>NYANLOLI LTD.</dd>
            </div>
            <div>
                <dt>Type</dt>
                <dd>Research &amp; Education</dd>
            </div>
            <div>
                <dt>Operating since</dt>
                <dd class="mono">2025</dd>
            </div>
            <div>
                <dt>PeeringDB</dt>
                <dd>
                    <a
                        class="arrow-link mono small"
                        href="https://www.peeringdb.com/net/29458"
                        target="_blank"
                        rel="noopener"
                        >net/29458 <span class="arr">↗</span></a
                    >
                </dd>
            </div>
            <div>
                <dt>IPv6 prefixes</dt>
                <dd>
                    <span v-if="loading" class="muted mono">Loading…</span>
                    <span v-else-if="error" class="muted">Unavailable</span>
                    <a v-else href="#prefixes" class="arrow-link small">
                        <span class="mono">{{ prefixes.length }}</span> announced <span class="arr">↑</span>
                    </a>
                </dd>
            </div>
        </dl>
    </section>
</template>

<style scoped lang="scss">
.ledger-title {
    font-family: var(--font-display);
    font-weight: 600;
    letter-spacing: -0.035em;
    font-size: clamp(22px, 2vw, 28px);
    margin: 0 0 16px;
}

.small {
    font-size: 13px;
}

.muted {
    color: var(--text-3);
}
</style>
