<script setup lang="ts">
// Справочники: базовые значения из данных, добавленные/скрытые — в сущностях dict-<ключ>. Подтипы привязаны к типу («Тип › Подтип»).
import { computed } from "vue";
import { S, all, api, load, toast, DICTDEF, dictValues, dictPatch, canEdit } from "../lib/store";
import { ACCESS } from "../lib/model";
const defs = computed(() => DICTDEF());
const ask = (msg: string, def = "") => (prompt(msg, def) || "").trim();
async function add(key: string, type?: string) {
  const v = ask(type ? `Новый подтип для «${type}»:` : "Новое значение:"); if (!v) return;
  const full = type ? type + " › " + v : v;
  try { await dictPatch(key, (st) => { st.removed = st.removed.filter((x) => x !== full); if (!st.added.includes(full)) st.added.push(full); }); toast(type ? "Подтип добавлен" : "Добавлено"); } catch (e: any) { toast("Ошибка: " + e.message); }
}
async function rm(key: string, v: string) {
  if (!confirm(`Убрать «${v}» из справочника? У старых карточек значение сохранится.`)) return;
  try { await dictPatch(key, (st) => { st.added = st.added.filter((x) => x !== v); if (!st.removed.includes(v)) st.removed.push(v); }); toast("Убрано"); } catch (e: any) { toast("Ошибка: " + e.message); }
}
async function edit(key: string, v: string, type?: string) {
  const cur = type ? v.slice(type.length + 3) : v;
  const n = ask("Переименовать значение:", cur); if (!n || n === cur) return;
  const nv = type ? type + " › " + n : n;
  try {
    await dictPatch(key, (st) => { st.added = st.added.filter((x) => x !== v); if (!st.removed.includes(v)) st.removed.push(v); st.removed = st.removed.filter((x) => x !== nv); if (!st.added.includes(nv)) st.added.push(nv); });
    toast("Переименовано. У существующих карточек прежнее значение — обновите их при необходимости.");
  } catch (e: any) { toast("Ошибка: " + e.message); }
}
async function tagCreate() { const n = ask("Новый тег:").replace(/^#/, ""); if (!n) return; if (all("tag").some((t) => t.title.toLowerCase() === n.toLowerCase())) return toast("Такой тег уже есть"); try { await api("/entities", { method: "POST", body: JSON.stringify({ type: "tag", title: n }) }); await load(); toast("Тег создан"); } catch (e: any) { toast("Ошибка: " + e.message); } }
async function tagEdit(id: string) { const t = S.db[id]; const n = ask("Переименовать тег:", t.title).replace(/^#/, ""); if (!n || n === t.title) return; try { await api("/entities/" + id, { method: "PATCH", body: JSON.stringify({ title: n }) }); await load(); toast("Переименовано"); } catch (e: any) { toast("Ошибка: " + e.message); } }
async function tagRm(id: string) { if (!confirm("Удалить тег? Он снимется со всех карточек.")) return; try { await api("/entities/" + id, { method: "DELETE" }); await load(); toast("Удалено"); } catch (e: any) { toast("Ошибка: " + e.message); } }
</script>
<template>
  <h1>Справочники</h1>
  <div class="muted" style="font-size:14px;margin:6px 0">Управляемые списки значений — используются в карточках и фильтрах. Убранное значение исчезает из выбора, но у старых карточек сохраняется.</div>
  <div class="grid g2" style="margin-top:14px">
    <div v-for="d in defs" :key="d.key" class="card"><b>{{ d.label }}</b> <span class="muted" style="font-size:12px">{{ dictValues(d.key).length }}</span>
      <template v-if="d.key.startsWith('sub:')">
        <div v-for="t in dictValues(d.key.slice(4))" :key="t" style="margin-top:10px"><div class="kicker">{{ t }}</div>
          <div class="chips" style="margin-top:4px">
            <span v-for="v in dictValues(d.key).filter(v => v.startsWith(t + ' › '))" :key="v" class="chip" style="font-size:13px"><span @click="canEdit && edit(d.key, v, t)" title="Переименовать">{{ v.slice(t.length + 3) }}</span><span v-if="canEdit" class="x" @click="rm(d.key, v)">✕</span></span>
            <span v-if="canEdit" class="chip add" @click="add(d.key, t)">＋</span>
          </div></div>
        <div v-if="!dictValues(d.key.slice(4)).length" class="muted" style="font-size:13px;margin-top:8px">Сначала добавьте типы в соответствующий справочник.</div>
        <div class="muted" style="font-size:11px;margin-top:8px">Подтип относится к типу: в карточке сущности он выбирается после типа.</div>
      </template>
      <template v-else>
        <div class="chips" style="margin-top:10px">
          <span v-for="v in dictValues(d.key)" :key="v" class="chip" style="font-size:13px"><span @click="canEdit && edit(d.key, v)" title="Переименовать">{{ v }}</span><span v-if="canEdit" class="x" @click="rm(d.key, v)">✕</span></span>
          <span v-if="canEdit" class="chip add" @click="add(d.key)">＋</span>
        </div>
        <div class="muted" style="font-size:11px;margin-top:8px">Клик по значению — переименовать, ✕ — убрать.</div>
      </template>
    </div>
    <div class="card"><b>Теги</b> <span class="muted" style="font-size:12px">{{ all('tag').length }}</span>
      <div class="chips" style="margin-top:10px"><span v-for="t in all('tag')" :key="t.id" class="chip" style="font-size:13px"><span @click="canEdit && tagEdit(t.id)">#{{ t.title }}</span><span v-if="canEdit" class="x" @click="tagRm(t.id)">✕</span></span><span v-if="canEdit" class="chip add" @click="tagCreate">＋</span></div>
      <div class="muted" style="font-size:11px;margin-top:8px">Служебные: помогают поиску, на публичном сайте не выводятся. Удаление снимает тег со всех карточек.</div>
    </div>
    <div class="card"><b>Уровни доступа</b> <span class="muted" style="font-size:12px">{{ Object.keys(ACCESS).length }}</span>
      <div class="chips" style="margin-top:10px"><span v-for="(l, v) in ACCESS" :key="v" class="chip" style="font-size:13px;cursor:default">{{ l }}</span></div>
      <div class="muted" style="font-size:12px;margin-top:8px">Системный — уровни задаются логикой доступа.</div>
    </div>
  </div>
</template>
