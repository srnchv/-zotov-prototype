<script setup lang="ts">
// Выбор из списка сущностей: вкладки по типам (если типов несколько), поиск, клик — выбор
import { ref, computed } from "vue";
import Modal from "./Modal.vue";
import { TYPES, type Entity } from "../lib/model";
const props = defineProps<{ title: string; items: Entity[]; typed?: boolean; sub?: (o: Entity) => string }>();
const emit = defineEmits<{ pick: [o: Entity]; close: [] }>();
const q = ref(""), type = ref<string | null>(null);
const byType = computed(() => { const m: Record<string, Entity[]> = {}; props.items.forEach((x) => (m[x.type] ||= []).push(x)); return m; });
const list = computed(() => {
  const ql = q.value.trim().toLowerCase();
  let arr = props.typed && type.value ? byType.value[type.value] || [] : props.items;
  if (ql) arr = props.items.filter((x) => x.title.toLowerCase().includes(ql) && (!type.value || x.type === type.value));
  else if (props.typed && !type.value) return [];
  return [...arr].sort((a, b) => a.title.localeCompare(b.title, "ru"));
});
</script>
<template>
  <Modal :title="title" wide @close="emit('close')">
    <input class="secsearch" placeholder="Поиск по названию…" v-model="q" autofocus>
    <div v-if="typed" class="chips" style="margin:12px 0 4px">
      <span v-for="t in Object.keys(TYPES).filter(t => byType[t])" :key="t" class="fchip" :class="{ on: type === t }" @click="type = type === t ? null : t">{{ TYPES[t].pl }} <span style="opacity:.6">{{ byType[t].length }}</span></span>
    </div>
    <div class="fmodal-list">
      <span v-for="o in list" :key="o.id" class="fopt" @click="emit('pick', o)">{{ o.title }} <span v-if="typed && q" class="muted" style="font-size:11px">· {{ TYPES[o.type]?.l }}</span><span v-if="sub" class="muted" style="font-size:11px"> · {{ sub(o) }}</span></span>
      <div v-if="!list.length" class="muted" style="font-size:13px;padding:14px 0">{{ typed && !type && !q ? "Выберите раздел выше — или начните вводить название." : "Ничего не найдено." }}</div>
    </div>
    <div class="right"><button class="btn dark" @click="emit('close')">Готово</button></div>
  </Modal>
</template>
