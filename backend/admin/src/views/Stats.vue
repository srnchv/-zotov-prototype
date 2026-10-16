<script setup lang="ts">
// Статистика посещаемости и работы редакции — только администратору
import { ref, onMounted } from "vue";
import { S, api } from "../lib/store";
import { TYPES } from "../lib/model";
const s = ref<any>(null), err = ref("");
async function reload() { s.value = null; err.value = ""; try { s.value = await api("/statistics"); } catch (e: any) { err.value = e.message; } }
onMounted(reload);
const PATHL: Record<string, string> = { "": "Главная", "/": "Главная", "/archive": "Поиск", "/search": "Поиск", "/chrono": "Хронограф", "/map": "Карта", "/texts": "Тексты", "/cabinet": "Личный кабинет" };
const pathLabel = (p: string) => PATHL[p] || (p.startsWith("/e/") || p.startsWith("/m/") ? "Карточка: " + ((S.db[p.slice(3)] || {}).title || p.slice(3)) : p.startsWith("/cat/") ? "Каталог: " + (TYPES[p.slice(5)]?.pl || p.slice(5)) : p);
const maxH = () => Math.max(1, ...(s.value?.byDay || []).map((d: any) => d.hits));
const devTotal = () => (s.value?.devices || []).reduce((a: number, d: any) => a + d.visitors, 0) || 1;
</script>
<template>
  <div style="display:flex;justify-content:space-between;align-items:baseline;gap:16px"><h1>Статистика</h1><button class="btn sm" @click="reload">Обновить</button></div>
  <div v-if="err" class="admbar err">Не удалось загрузить ({{ err }}).</div>
  <div v-else-if="!s" class="muted" style="margin-top:20px">Собираем данные…</div>
  <template v-else>
    <div class="grid g4" style="margin-top:16px">
      <div v-for="[n, l] in [[s.visitors, 'Посетителей всего'], [s.hits, 'Просмотров страниц'], [s.byDay.at(-1)?.visitors || 0, 'Посетителей сегодня'], [s.byDay.at(-1)?.hits || 0, 'Просмотров сегодня']]" :key="l" class="card" style="padding:16px"><div style="font-size:28px;font-weight:600">{{ n }}</div><div class="muted" style="font-size:13px">{{ l }}</div></div>
    </div>
    <div class="grid g2" style="margin-top:20px">
      <div class="card"><b>Просмотры по дням</b>
        <div v-if="s.byDay.length" class="bar"><div v-for="d in s.byDay" :key="d.day"><span class="muted" style="font-size:10px">{{ d.hits }}</span><i :style="{ height: Math.round(d.hits / maxH() * 80) + 2 + 'px' }" :title="`${d.day}: ${d.hits} просмотров · ${d.visitors} посетителей`"></i><span class="muted" style="font-size:10px;white-space:nowrap">{{ d.day.slice(5) }}</span></div></div>
        <div v-else class="muted" style="font-size:13px;margin-top:10px">Данные появятся после первых визитов на публичную часть.</div></div>
      <div class="card"><b>Устройства</b>
        <div style="margin-top:14px"><div v-for="d in s.devices" :key="d.device" style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:13px"><span>{{ d.device }}</span><span class="muted">{{ d.visitors }} · {{ Math.round(d.visitors / devTotal() * 100) }}%</span></div><div style="background:var(--fill);height:8px;margin-top:4px"><div style="background:var(--ink);height:8px" :style="{ width: Math.round(d.visitors / devTotal() * 100) + '%' }"></div></div></div>
          <div v-if="!s.devices.length" class="muted" style="font-size:13px">Пока нет данных.</div></div>
        <div class="muted" style="font-size:12px;margin-top:12px">Считаем сами, без кук: анонимный идентификатор браузера.</div></div>
    </div>
    <div class="grid g3" style="margin-top:20px">
      <div class="card"><b>Популярные страницы</b><table class="atable"><tr v-for="r in s.pages" :key="r.path"><td style="font-size:13px">{{ pathLabel(r.path) }}</td><td class="muted" style="text-align:right">{{ r.hits }}</td></tr></table></div>
      <div class="card"><b>Топ сущностей по просмотрам</b><table class="atable"><tr v-for="r in s.topViewed" :key="r.id"><td style="font-size:13px"><router-link class="lnk" :to="'/edit/' + r.id">{{ r.title }}</router-link></td><td class="muted" style="text-align:right">{{ r.views }}</td></tr></table></div>
      <div class="card"><b>Чаще всего правили</b><table class="atable"><tr v-for="r in (s.topEdited || [])" :key="r.id"><td style="font-size:13px"><router-link class="lnk" :to="'/edit/' + r.id">{{ r.title || r.id }}</router-link></td><td class="muted" style="text-align:right">{{ r.edits }}</td></tr></table><div v-if="!(s.topEdited || []).length" class="muted" style="font-size:13px;margin-top:8px">—</div></div>
    </div>
  </template>
</template>
