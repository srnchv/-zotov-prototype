<script setup lang="ts">
// Список сущностей: фильтр по типу, поиск, сортировка по колонкам, массовые действия
import { ref, computed, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import { S, SITE, api, load, loadAudit, toast, canEdit } from "../lib/store";
import { TYPES, CONTENT_TYPES, pubStat, dateOf, yearOf, fmtAt, type Entity } from "../lib/model";
const route = useRoute();
const type = ref<string>((route.query.type as string) || "all"), q = ref(""), sortKey = ref("title"), dir = ref(1), sel = ref(new Set<string>());
watch(() => route.query.type, (t) => { if (t) type.value = String(t); });
onMounted(() => loadAudit());
const sum = computed(() => S.audit?.summary || {});
const rows = computed(() => {
  const val: Record<string, (o: Entity) => string | number> = {
    title: (o) => o.title, type: (o) => TYPES[o.type]?.l || o.type, date: (o) => yearOf(dateOf(o)), status: (o) => o.status || "published",
    views: (o) => Number(o.views) || 0, edits: (o) => sum.value[o.id]?.edits || 0, changed: (o) => sum.value[o.id]?.lastAt || "",
  };
  const v = val[sortKey.value] || val.title, ql = q.value.trim().toLowerCase();
  return S.raw.filter((o) => CONTENT_TYPES.includes(o.type)).filter((o) => type.value === "all" || o.type === type.value)
    .filter((o) => !ql || o.title.toLowerCase().includes(ql))
    .sort((a, b) => { const x = v(a), y = v(b); return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "ru")) * dir.value; });
});
const sort = (k: string) => { if (sortKey.value === k) dir.value = -dir.value; else { sortKey.value = k; dir.value = 1; } };
const arrow = (k: string) => (sortKey.value === k ? (dir.value > 0 ? " ↑" : " ↓") : "");
const toggle = (id: string) => { const s = new Set(sel.value); s.has(id) ? s.delete(id) : s.add(id); sel.value = s; };
const allSel = computed(() => rows.value.length > 0 && rows.value.every((o) => sel.value.has(o.id)));
const toggleAll = () => { const s = new Set(sel.value); allSel.value ? rows.value.forEach((o) => s.delete(o.id)) : rows.value.forEach((o) => s.add(o.id)); sel.value = s; };
async function bulk(action: string) {
  const ids = [...sel.value]; if (!ids.length) return;
  if (action === "delete" && !confirm(`Удалить ${ids.length} сущн. и все их связи?`)) return;
  try {
    for (const id of ids) action === "delete" ? await api("/entities/" + id, { method: "DELETE" }) : await api("/entities/" + id, { method: "PATCH", body: JSON.stringify({ status: action }) });
    sel.value = new Set(); await load(); loadAudit(true);
    toast(action === "delete" ? "Удалено" : action === "published" ? "Опубликовано" : "Перенесено в черновики");
  } catch (e: any) { toast("Ошибка: " + e.message); }
}
</script>
<template>
  <div style="display:flex;justify-content:space-between;align-items:baseline;gap:16px"><h1>Сущности</h1><router-link v-if="canEdit" class="btn dark" to="/new">＋ Создать сущность</router-link></div>
  <input class="secsearch" placeholder="Поиск по названию…" v-model="q">
  <div class="chips" style="margin:12px 0">
    <span class="chip" :class="{ on: type === 'all' }" @click="type = 'all'">Все</span>
    <span v-for="t in CONTENT_TYPES" :key="t" class="chip" :class="{ on: type === t }" @click="type = t">{{ TYPES[t].pl }}</span>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;margin:4px 0 10px">
    <span class="muted" style="font-size:13px">{{ rows.length }} записей · сортировка по клику на заголовок</span>
    <span v-if="sel.size" style="display:flex;gap:8px;align-items:center">
      <span class="muted" style="font-size:13px">Выбрано: {{ sel.size }}</span>
      <button class="btn sm" @click="bulk('published')">Опубликовать</button>
      <button class="btn sm" @click="bulk('draft')">В черновики</button>
      <button v-if="canEdit" class="btn sm danger" @click="bulk('delete')">Удалить</button>
      <span class="lnk" style="font-size:13px" @click="sel = new Set()">снять выбор</span>
    </span>
  </div>
  <table class="atable"><thead><tr>
    <th style="width:26px"><input type="checkbox" :checked="allSel" @change="toggleAll"></th>
    <th @click="sort('title')">Название{{ arrow('title') }}</th><th @click="sort('type')">Тип{{ arrow('type') }}</th><th @click="sort('date')">Дата{{ arrow('date') }}</th>
    <th @click="sort('status')">Статус{{ arrow('status') }}</th><th @click="sort('views')" style="text-align:right">Просмотры{{ arrow('views') }}</th>
    <th @click="sort('edits')" style="text-align:right">Правки{{ arrow('edits') }}</th><th @click="sort('changed')">Изменён{{ arrow('changed') }}</th><th></th>
  </tr></thead>
  <tbody>
    <tr v-for="o in rows" :key="o.id">
      <td><input type="checkbox" :checked="sel.has(o.id)" @change="toggle(o.id)"></td>
      <td><router-link :to="'/edit/' + o.id" style="font-weight:500">{{ o.title }}</router-link></td>
      <td class="muted">{{ TYPES[o.type]?.l }}</td>
      <td class="muted">{{ dateOf(o) || "—" }}</td>
      <td><span class="statbadge" :class="{ draft: (o.status || 'published') !== 'published' }">{{ pubStat(o) }}</span></td>
      <td class="muted" style="text-align:right">{{ Number(o.views) || 0 }}</td>
      <td class="muted" style="text-align:right">{{ sum[o.id]?.edits || 0 }}</td>
      <td class="muted" style="font-size:12px;white-space:nowrap"><template v-if="sum[o.id]">{{ fmtAt(sum[o.id].lastAt) }}<br>{{ sum[o.id].lastActor }}</template><template v-else>—</template></td>
      <td style="text-align:right;white-space:nowrap"><router-link class="btn sm" :to="'/edit/' + o.id">Открыть</router-link> <a class="btn sm" :href="SITE + '/m/' + o.id" target="_blank">На сайте</a></td>
    </tr>
  </tbody></table>
  <p v-if="!rows.length" class="muted" style="margin-top:20px">Ничего не найдено.</p>
</template>
