<script setup lang="ts">
defineOptions({
    name: 'TipsComponent'
})

defineProps<{
    title?: string
}>()
</script>

<template>
    <aside class="callout">
        <div v-if="title" class="callout-title mono">{{ title }}</div>
        <div class="callout-body">
            <slot />
        </div>
    </aside>
</template>

<style scoped>
.callout {
    border-left: 4px solid var(--accent);
    padding: 4px 0 4px 18px;
}

.callout-title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--accent);
    margin-bottom: 8px;
}

/* 长的 community 示例在窄屏下横向滚动而不是撑破布局 */
.callout-body {
    max-width: 100%;
    overflow-x: auto;
    font-size: 13px;
}
</style>
