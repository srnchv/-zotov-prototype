<script setup lang="ts">
// Тексты сайта: поиск, хронограф, ссылки меню и футера, соцсети (тексты главной — в разделе «Главная страница»)
import { reactive } from "vue";
import { siteVal, patchSite, toast, canEdit } from "../lib/store";
import { SITE_DEF } from "../lib/model";
const f = reactive<Record<string, string>>({});
SITE_DEF.flatMap((g) => g[1]).forEach(([k]) => (f[k] = siteVal(k)));
async function save() { try { await patchSite(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim()]))); toast("Сохранено — тексты обновлены на сайте"); } catch (e: any) { toast("Ошибка: " + e.message); } }
</script>
<template>
  <h1>Тексты сайта</h1>
  <div class="muted" style="font-size:14px;margin:6px 0 18px;max-width:720px">Тексты поиска и хронографа, ссылки в меню и футере, соцсети. Тексты главной — в разделе «Главная страница». Сохранённое сразу появляется на сайте.</div>
  <div class="grid g2" style="gap:16px;align-items:start">
    <div v-for="[title, fields] in SITE_DEF" :key="title" class="card"><b>{{ title }}</b>
      <div v-for="[k, l, , ta] in fields" :key="k" class="field" style="margin-top:10px"><label>{{ l }}</label>
        <textarea v-if="ta" class="inp" v-model="f[k]" style="min-height:96px" :disabled="!canEdit"></textarea><input v-else class="inp" v-model="f[k]" :disabled="!canEdit"></div>
    </div>
  </div>
  <div v-if="canEdit" style="display:flex;gap:10px;margin-top:20px"><button class="btn dark" @click="save">Сохранить</button></div>
</template>
