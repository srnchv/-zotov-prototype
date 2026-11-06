<script setup lang="ts">
import Dialog from "./components/Dialog.vue";
// Каркас админки в дизайне сайта: левое меню 180 (логотип, «АРХИВ», разделы, «Публичный сайт», роль и «Выйти»),
// контент справа; на планшете и мобайле — шапка с логотипом и кнопкой «Меню», как на сайте.
import { onMounted, computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { S, SITE, logged, isAdmin, logout, load } from "./lib/store";
import { ROLE_LABEL } from "./lib/model";
import { JOB } from "./lib/tourJob";
const route = useRoute();
const TABS = computed(() => [
  ["/dash", "Дашборд"], ["/entities", "Сущности"], ["/dict", "Справочники"], ["/media", "Медиатека"], ["/import", "Импорт"], ["/home", "Главная страница"], ["/site", "Тексты сайта"],
  ...(isAdmin.value ? [["/stats", "Статистика"], ["/users", "Пользователи"]] : []),
]);
const menu = ref(false);
watch(() => route.path, () => { menu.value = false; });
onMounted(() => { if (logged.value) load(); window.addEventListener("beforeunload", (e) => { if (JOB.cur?.running) { e.preventDefault(); e.returnValue = ""; } }); });
const out = () => { logout(); location.href = "/admin/login"; };
const LETTERS = ["a", "r", "h", "i", "v"];
</script>
<template>
  <template v-if="!logged || route.path === '/login'"><router-view /></template>
  <template v-else>
    <div class="cab">
      <!-- шапка планшета/мобайла -->
      <div class="mob">
        <div class="lg">
          <router-link class="box" to="/dash" aria-label="Дашборд"><svg viewBox="0 0 136 88" fill="#262626" xmlns="http://www.w3.org/2000/svg"><path d="M49.8872 0H86.1128V7.99854H76.3023V88H59.7018V7.99854H49.8872V0Z"/><path d="M18.7296 0H45.7431V88H18.7296V0ZM25.8127 80.0015H34.3165V8.00256H25.8127V80.0015Z"/><path d="M90.2569 0H117.27V88H90.2569V0ZM101.688 80.0015H110.191V8.00256H101.688V80.0015Z"/><path d="M132.524 21.9748L129.369 40.0007H128.384V7.99854H132.528V21.9748H132.524ZM132.524 80.0015H128.38V48.0033H132.524V80.0015ZM123.328 0V88H136V39.9967H133.199L136 23.9996V0H123.328Z"/><path d="M12.6723 0H0V23.9996H3.4805V7.99854H7.62046V26.0285L3.4805 39.9967V48.0033H7.62046V80.0015H3.4805V64.0044H0V88H12.6723V39.9967H7.92577L12.6723 23.9996V0Z"/></svg></router-link>
          <button type="button" @click="menu = !menu">{{ menu ? "Закрыть" : "Меню" }}</button>
        </div>
        <a class="ext" :href="SITE" target="_blank">Публичный сайт</a>
      </div>
      <aside class="side" :class="{ open: menu }">
        <router-link class="logo" to="/dash" aria-label="Дашборд"><svg viewBox="0 0 136 88" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M49.8872 0H86.1128V7.99854H76.3023V88H59.7018V7.99854H49.8872V0Z"/><path d="M18.7296 0H45.7431V88H18.7296V0ZM25.8127 80.0015H34.3165V8.00256H25.8127V80.0015Z"/><path d="M90.2569 0H117.27V88H90.2569V0ZM101.688 80.0015H110.191V8.00256H101.688V80.0015Z"/><path d="M132.524 21.9748L129.369 40.0007H128.384V7.99854H132.528V21.9748H132.524ZM132.524 80.0015H128.38V48.0033H132.524V80.0015ZM123.328 0V88H136V39.9967H133.199L136 23.9996V0H123.328Z"/><path d="M12.6723 0H0V23.9996H3.4805V7.99854H7.62046V26.0285L3.4805 39.9967V48.0033H7.62046V80.0015H3.4805V64.0044H0V88H12.6723V39.9967H7.92577L12.6723 23.9996V0Z"/></svg></router-link>
        <div class="arhiv"><img v-for="l in LETTERS" :key="l" :src="'/admin/letters/letter-' + l + '.svg'" alt=""></div>
        <nav>
          <router-link v-for="[p, l] in TABS" :key="p" :to="p" :class="{ active: route.path === p || (p === '/entities' && /^\/(edit|new)/.test(route.path)) }">{{ l }}</router-link>
          <a class="ext" href="/admin/help.html" target="_blank"><span>Инструкция</span><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 2v1.5H3.5v9h9V10H14v4H2V2h4Zm8 0v5.5h-1.5V4.56L7.53 9.53 6.47 8.47l4.97-4.97H8.5V2H14Z" fill="currentColor" /></svg></a>
          <a class="ext" :href="SITE" target="_blank"><span>Публичный сайт</span><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 2v1.5H3.5v9h9V10H14v4H2V2h4Zm8 0v5.5h-1.5V4.56L7.53 9.53 6.47 8.47l4.97-4.97H8.5V2H14Z" fill="currentColor" /></svg></a>
        </nav>
        <div class="who">
          <span v-if="S.apiLive === false" class="muted" style="color:var(--red)">Стенд недоступен</span>
          <span>{{ S.name }} · {{ ROLE_LABEL[S.role] }}</span>
          <button class="btn dark" @click="out"><span>Выйти</span></button>
        </div>
      </aside>
      <main class="content">
        <div v-if="S.apiLive === false" class="admbar err">Стенд недоступен — данные не загрузились, изменения не сохранятся.</div>
        <router-view />
      </main>
    </div>
  </template>
  <div v-for="t in S.toasts" :key="t.id" class="toast">{{ t.msg }}</div>
  <Dialog />
</template>
