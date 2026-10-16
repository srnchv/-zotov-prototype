<script setup lang="ts">
// Кадр для карточек: точка фокуса фото (в % от ширины/высоты) — карточки на сайте обрезают фото вокруг неё
import { ref } from "vue";
import Modal from "./Modal.vue";
import { api, load, toast, S } from "../lib/store";
import type { Entity } from "../lib/model";
const props = defineProps<{ media: Entity; parentId: string }>();
const emit = defineEmits<{ close: [] }>();
const focus = ref<string>(props.media.focus || "50% 50%");
const src = props.media.med || props.media.big || props.media.thumb;
const fx = () => focus.value.split(" ")[0], fy = () => focus.value.split(" ")[1];
function pick(ev: MouseEvent) {
  const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
  const x = Math.round(Math.min(100, Math.max(0, ((ev.clientX - r.left) / r.width) * 100)));
  const y = Math.round(Math.min(100, Math.max(0, ((ev.clientY - r.top) / r.height) * 100)));
  focus.value = `${x}% ${y}%`;
}
async function save() {
  try {
    await api("/entities/" + props.media.id, { method: "PATCH", body: JSON.stringify({ payload: { focus: focus.value } }) });
    const p = S.db[props.parentId];
    if (p && (p.cover === props.media.id || (!p.cover && p.img === props.media.thumb))) await api("/entities/" + props.parentId, { method: "PATCH", body: JSON.stringify({ payload: { imgPos: focus.value } }) });
    await load(); toast("Кадр сохранён — карточки обновятся на сайте"); emit("close");
  } catch (e: any) { toast("Ошибка: " + e.message); }
}
const PREV: [string, number, number][] = [["Квадрат 1:1 — поиск, темы", 184, 184], ["Горизонталь 3:2 — проекты, коллекции", 276, 184], ["Вертикаль 4:5 — личности", 132, 165]];
</script>
<template>
  <Modal title="Кадр для карточек" wide @close="emit('close')">
    <div class="muted" style="font-size:13px;margin:8px 0 14px">Кликните по фото — это точка, вокруг которой карточки обрезают снимок. Справа — как он ляжет в разные пропорции.</div>
    <div style="display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap">
      <div style="position:relative;flex:1 1 520px;min-width:280px;cursor:crosshair;line-height:0" @click="pick">
        <img :src="src" style="width:100%;display:block;user-select:none" draggable="false">
        <span :style="{ position: 'absolute', left: fx(), top: fy(), width: '22px', height: '22px', margin: '-11px 0 0 -11px', border: '3px solid #fff', borderRadius: '50%', background: 'rgba(244,60,58,.85)', boxShadow: '0 0 0 2px rgba(0,0,0,.35)', pointerEvents: 'none' }"></span>
      </div>
      <div style="display:flex;flex-direction:column;gap:14px;flex:0 0 300px">
        <div v-for="[l, w, h] in PREV" :key="l"><div class="kicker" style="margin-bottom:6px">{{ l }}</div><div class="crop-prev" :style="{ width: w + 'px', height: h + 'px', backgroundImage: `url('${src}')`, backgroundPosition: focus }"></div></div>
      </div>
    </div>
    <div class="right"><button class="btn" @click="focus = '50% 50%'">По центру</button><button class="btn dark" @click="save">Сохранить</button></div>
  </Modal>
</template>
