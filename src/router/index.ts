import { createRouter, createWebHistory } from 'vue-router'

import CaeserView from '@/views/ceaser.vue'

const routes = [{ path: '/', component: CaeserView }]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
