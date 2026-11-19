<script setup lang="ts">
import { shallowRef, watch, type Component } from 'vue'
import { cachedFlag, loadFlag } from '@/utils/flags'
import { regionName } from '@/composables/useLatency'

defineOptions({
    name: 'CountryFlag'
})

const props = withDefaults(
    defineProps<{
        /** ISO 3166-1 两位码，大小写均可 */
        code?: string | null
        size?: number
    }>(),
    { code: null, size: 16 }
)

const comp = shallowRef<Component | null>(cachedFlag(props.code))

watch(
    () => props.code,
    async (code) => {
        const cached = cachedFlag(code)
        comp.value = cached
        if (cached || !code) return
        const loaded = await loadFlag(code)
        if (code === props.code) comp.value = loaded
    },
    { immediate: true }
)
</script>

<template>
    <span class="flag" :style="{ width: `${size}px`, height: `${size}px` }">
        <component
            :is="comp"
            v-if="comp"
            :width="size"
            :height="size"
            :title="regionName(code ?? undefined) ?? code ?? ''"
        />
    </span>
</template>

<style scoped>
/* 占位圆：旗帜加载前保持尺寸，避免布局跳动 */
.flag {
    display: inline-block;
    flex-shrink: 0;
    border-radius: 50%;
    background: var(--line);
    vertical-align: middle;
    overflow: hidden;
    box-shadow: 0 0 0 1px var(--line);
}

.flag :deep(svg) {
    display: block;
}
</style>
