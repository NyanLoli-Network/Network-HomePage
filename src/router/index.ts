import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            name: 'home',
            component: () => import('@/pages/home/home.vue')
        },
        {
            path: '/communities',
            name: 'communities',
            component: () => import('@/pages/communities/communities.vue')
        }
    ],
    scrollBehavior(to, _from, savedPosition) {
        if (savedPosition) return savedPosition
        if (to.hash) return { el: to.hash, behavior: 'smooth' }
        return { top: 0 }
    }
})

export default router
