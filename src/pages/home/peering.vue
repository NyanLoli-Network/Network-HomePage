<script setup lang="ts">
defineOptions({
    name: 'PeeringComponent'
})
</script>

<template>
    <section>
        <h3 class="ledger-title">Peering policy</h3>
        <dl class="spec-list">
            <div>
                <dt>Policy</dt>
                <dd>Open</dd>
            </div>
            <div>
                <dt>Requirements</dt>
                <dd>Any IXP we are present at</dd>
            </div>
            <div>
                <dt>Transit</dt>
                <dd>Free for research &amp; education</dd>
            </div>
            <div>
                <dt>Tunnels</dt>
                <dd class="mono">GRE · VXLAN · WireGuard</dd>
            </div>
            <div>
                <dt>Address family</dt>
                <dd class="mono">IPv6 only</dd>
            </div>
            <div>
                <dt>NOC</dt>
                <dd>
                    <a class="arrow-link mono small" href="mailto:noc@nyanloli.com">noc@nyanloli.com</a>
                </dd>
            </div>
        </dl>
    </section>
</template>

<style scoped>
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
</style>
