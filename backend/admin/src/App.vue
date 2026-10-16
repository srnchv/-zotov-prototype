<script setup lang="ts">
// Каркас админки: чёрная шапка, меню слева, содержимое справа; тосты
import { onMounted, computed } from "vue";
import { useRoute } from "vue-router";
import { S, SITE, logged, isAdmin, logout, load } from "./lib/store";
import { ROLE_LABEL } from "./lib/model";
const route = useRoute();
const TABS = computed(() => [
  ["/dash", "Дашборд"], ["/entities", "Сущности"], ["/dict", "Справочники"], ["/media", "Медиатека"], ["/home", "Главная страница"], ["/site", "Тексты сайта"],
  ...(isAdmin.value ? [["/stats", "Статистика"], ["/users", "Пользователи"]] : []),
]);
onMounted(() => { if (logged.value) load(); });
const out = () => { logout(); location.href = "/admin/login"; };
</script>
<template>
  <template v-if="!logged || route.path === '/login'"><router-view /></template>
  <template v-else>
    <header class="top"><div class="row">
      <a class="logo" href="/admin/dash">Зотов · Архив <span>/ админ</span></a>
      <nav>
        <span v-if="S.apiLive === true" class="apilive on" title="Данные стенда">API</span>
        <span v-else-if="S.apiLive === false" class="apilive off" title="Стенд недоступен">офлайн</span>
        <span>{{ S.name }} · {{ ROLE_LABEL[S.role] }}</span>
        <button class="btn sm" @click="out">Выйти</button>
      </nav>
    </div></header>
    <main class="wrap">
      <div v-if="S.apiLive === false" class="admbar err">Стенд недоступен — данные не загрузились, изменения не сохранятся.</div>
      <div class="cab">
        <aside class="side">
          <router-link v-for="[p, l] in TABS" :key="p" :to="p" :class="{ active: route.path === p || (p === '/entities' && /^\/(edit|new)/.test(route.path)) }">{{ l }}</router-link>
          <a :href="SITE" target="_blank" style="margin-top:14px;border-top:1px solid var(--line);padding-top:12px;font-size:13px">← На публичный сайт</a>
        </aside>
        <div><router-view /></div>
      </div>
    </main>
  </template>
  <div v-for="t in S.toasts" :key="t.id" class="toast">{{ t.msg }}</div>
</template>
