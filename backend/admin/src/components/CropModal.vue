<script setup lang="ts">
// Кадр фото: точка (в % ширины/высоты) и масштаб — отдельно для десктопа и мобайла (≤599px).
// На сайте картинки обрезаются вокруг точки (object-position) и увеличиваются от неё (scale).
import { ref, computed, reactive } from "vue";
import Modal from "./Modal.vue";
export type Frame = { x: number; y: number; s: number };
export type Frames = { d?: Frame; m?: Frame };
type Prev = [string, number, number];
const props = defineProps<{ src: string; frames?: Frames | null; title?: string; previews?: { d: Prev[]; m: Prev[] } }>();
const emit = defineEmits<{ close: []; save: [frames: Frames] }>();
const DEF: Frame = { x: 50, y: 50, s: 1 };
const PREV = props.previews || {
  d: [["Квадрат 1:1 — поиск, темы", 184, 184], ["Горизонталь 3:2 — проекты, коллекции", 276, 184], ["Вертикаль 4:5 — личности", 132, 165]],
  m: [["Карточка в поиске, 1:1", 160, 160], ["Проекты, коллекции 3:2", 240, 160], ["Личности 4:5", 132, 165]],
};
const dev = ref<"d" | "m">("d");
const fr = reactive<{ d: Frame; m: Frame | null }>({ d: { ...(props.frames?.d || DEF) }, m: props.frames?.m ? { ...props.frames.m } : null });
const cur = computed<Frame>(() => (dev.value === "m" ? fr.m || fr.d : fr.d));
const ownM = computed({ get: () => !!fr.m, set: (v) => { fr.m = v ? { ...fr.d } : null; } });
const clamp = (v: number, a = 0, b = 100) => Math.min(b, Math.max(a, v));
function setXY(x: number, y: number) { const f = cur.value; f.x = Math.round(clamp(x)); f.y = Math.round(clamp(y)); }
function pick(ev: MouseEvent) {
  const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
  setXY(((ev.clientX - r.left) / r.width) * 100, ((ev.clientY - r.top) / r.height) * 100);
}
// перетаскивание прямо в превью: фото едет за курсором, точка кадра смещается в обратную сторону
let drag: { x: number; y: number; fx: number; fy: number; w: number; h: number } | null = null;
function dstart(ev: PointerEvent) {
  const el = ev.currentTarget as HTMLElement; el.setPointerCapture(ev.pointerId);
  drag = { x: ev.clientX, y: ev.clientY, fx: cur.value.x, fy: cur.value.y, w: el.clientWidth, h: el.clientHeight };
}
function dmove(ev: PointerEvent) {
  if (!drag) return;
  const s = cur.value.s || 1;
  setXY(drag.fx - ((ev.clientX - drag.x) / (drag.w * s)) * 100, drag.fy - ((ev.clientY - drag.y) / (drag.h * s)) * 100);
}
function dend() { drag = null; }
const imgStyle = (f: Frame) => ({ objectPosition: `${f.x}% ${f.y}%`, transformOrigin: `${f.x}% ${f.y}%`, transform: `scale(${f.s || 1})` });
function save() {
  const out: Frames = { d: { ...fr.d } };
  if (fr.m) out.m = { ...fr.m };
  emit("save", out);
}
</script>
<template>
  <Modal :title="title || 'Кадр фото'" wide @close="emit('close')">
    <div class="tabs" style="margin-bottom:12px">
      <button class="tab" :class="{ on: dev === 'd' }" @click="dev = 'd'">Десктоп</button>
      <button class="tab" :class="{ on: dev === 'm' }" @click="dev = 'm'">Мобайл</button>
      <label v-if="dev === 'm'" style="margin-left:auto;font-size:13px;display:flex;gap:6px;align-items:center"><input type="checkbox" v-model="ownM"> свой кадр для мобайла</label>
    </div>
    <div class="muted" style="font-size:13px;margin:0 0 12px">
      <template v-if="dev === 'm' && !ownM">На телефонах используется кадр десктопа. Включите «свой кадр для мобайла», чтобы сдвинуть или приблизить фото только для телефонов.</template>
      <template v-else>Кликните по фото — это точка, вокруг которой обрезается снимок. В превью справа фото можно тащить мышью, масштаб — ползунком.</template>
    </div>
    <div style="display:flex;gap:24px;align-items:flex-start;flex-wrap:wrap" :style="dev === 'm' && !ownM ? 'opacity:.55;pointer-events:none' : ''">
      <div style="flex:1 1 480px;min-width:280px">
        <div style="position:relative;cursor:crosshair;line-height:0" @click="pick">
          <img :src="src" style="width:100%;display:block;user-select:none" draggable="false">
          <span :style="{ position: 'absolute', left: cur.x + '%', top: cur.y + '%', width: '22px', height: '22px', margin: '-11px 0 0 -11px', border: '3px solid #fff', borderRadius: '50%', background: 'rgba(244,60,58,.85)', boxShadow: '0 0 0 2px rgba(0,0,0,.35)', pointerEvents: 'none' }"></span>
        </div>
        <div style="display:flex;align-items:center;gap:12px;margin-top:12px;font-size:13px">
          <span>Масштаб</span>
          <input type="range" min="1" max="3" step="0.05" v-model.number="cur.s" style="flex:1">
          <span style="width:40px;text-align:right">{{ (cur.s || 1).toFixed(2) }}×</span>
          <button class="btn sm" @click="cur.s = 1">1×</button>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:14px;flex:0 0 300px">
        <div v-for="[l, w, h] in PREV[dev]" :key="l">
          <div class="kicker" style="margin-bottom:6px">{{ l }}</div>
          <div class="crop-prev" :style="{ width: w + 'px', height: h + 'px', backgroundImage: 'none', overflow: 'hidden', cursor: 'grab', touchAction: 'none' }" @pointerdown="dstart" @pointermove="dmove" @pointerup="dend" @pointercancel="dend">
            <img :src="src" draggable="false" :style="{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', userSelect: 'none', pointerEvents: 'none', ...imgStyle(cur) }">
          </div>
        </div>
      </div>
    </div>
    <div class="right" style="margin-top:16px">
      <button class="btn" @click="setXY(50, 50); cur.s = 1">По центру</button>
      <button class="btn dark" @click="save">Сохранить</button>
    </div>
  </Modal>
</template>
