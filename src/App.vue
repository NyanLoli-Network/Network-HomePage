<script setup lang="ts">
import appbar from '@/components/appbar.vue'
import SiteFooter from '@/components/SiteFooter.vue'

defineOptions({
    name: 'AppComponent'
})
</script>

<template>
    <v-app>
        <appbar />
        <main class="site-main">
            <router-view />
        </main>
        <SiteFooter />
    </v-app>
</template>

<style>
.site-main {
    flex: 1 0 auto;
}
</style>
