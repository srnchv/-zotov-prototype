import { createRouter, createWebHistory } from "vue-router";
import { S, isAdmin } from "./lib/store";
export const router = createRouter({
  history: createWebHistory("/admin/"),
  routes: [
    { path: "/login", component: () => import("./views/Login.vue") },
    { path: "/", redirect: "/dash" },
    { path: "/dash", component: () => import("./views/Dash.vue") },
    { path: "/entities", component: () => import("./views/Entities.vue") },
    { path: "/new", component: () => import("./views/New.vue") },
    { path: "/edit/:id", component: () => import("./views/Edit.vue"), props: true },
    { path: "/dict", component: () => import("./views/Dict.vue") },
    { path: "/media", component: () => import("./views/Media.vue") },
    { path: "/home", component: () => import("./views/Home.vue") },
    { path: "/site", component: () => import("./views/Site.vue") },
    { path: "/stats", component: () => import("./views/Stats.vue"), meta: { admin: true } },
    { path: "/users", component: () => import("./views/Users.vue"), meta: { admin: true } },
    { path: "/:rest(.*)", redirect: "/dash" },
  ],
});
router.beforeEach((to) => {
  if (to.path !== "/login" && !S.token) return "/login";
  if (to.path === "/login" && S.token) return "/dash";
  if (to.meta.admin && !isAdmin.value) return "/dash";
});
