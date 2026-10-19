<script setup lang="ts">
// Координаты места: поиск по адресу (геокодер Яндекса через бэкенд) + мини-карта с перетаскиваемой точкой.
// Утраченные здания и старые адреса геокодер не знает — точку ставят руками: клик по карте или перетащить маркер.
import { ref, watch, onMounted, onBeforeUnmount } from "vue";
import { api, toast } from "../lib/store";
import { loadYmaps } from "../lib/ymaps";
const props = defineProps<{ lat: string; lon: string; address: string }>();
const emit = defineEmits<{ update: [lat: string, lon: string]; addr: [text: string] }>();
const q = ref(props.address || ""), hits = ref<any[]>([]), busy = ref(false), mapErr = ref("");
// подсказки при вводе (геосаджест): с задержкой, от двух символов
const sug = ref<{ title: string; subtitle: string; address: string }[]>([]);
let sugT: any = null;
function onType() {
  clearTimeout(sugT); hits.value = [];
  if (q.value.trim().length < 2) { sug.value = []; return; }
  sugT = setTimeout(async () => { try { sug.value = await api(`/suggest?q=${encodeURIComponent(q.value.trim())}`); } catch { sug.value = []; } }, 250);
}
function pickSug(s: { address: string }) { q.value = s.address; sug.value = []; find(); }
const box = ref<HTMLElement>();
let map: any = null, marker: any = null, Y: any = null;
const num = (v: string) => { const n = parseFloat(String(v).replace(",", ".")); return Number.isFinite(n) ? n : null; };
async function find() {
  if (!q.value.trim()) return; busy.value = true;
  try { hits.value = await api(`/geo?q=${encodeURIComponent(q.value.trim())}`); if (!hits.value.length) toast("Адрес не найден — поставьте точку на карте вручную"); }
  catch (e: any) { toast("Ошибка: " + e.message); }
  busy.value = false;
}
function pick(h: any) { emit("update", h.lat.toFixed(6), h.lon.toFixed(6)); hits.value = []; }
function setMarker(lat: number, lon: number, center = true) {
  if (!map || !Y) return;
  if (!marker) {
    const el = document.createElement("div"); el.style.cssText = "width:18px;height:18px;border-radius:50%;background:#f43c3a;border:3px solid #fff;box-shadow:0 0 0 2px rgba(0,0,0,.35);transform:translate(-50%,-50%);cursor:grab";
    marker = new Y.YMapMarker({ coordinates: [lon, lat], draggable: true, onDragEnd: (c: number[]) => emit("update", c[1].toFixed(6), c[0].toFixed(6)) }, el);
    map.addChild(marker);
  } else marker.update({ coordinates: [lon, lat] });
  if (center) map.setLocation({ center: [lon, lat], zoom: Math.max(map.zoom, 15), duration: 300 });
}
onMounted(async () => {
  try {
    Y = await loadYmaps();
    const lat = num(props.lat), lon = num(props.lon);
    map = new Y.YMap(box.value!, { location: { center: lon != null && lat != null ? [lon, lat] : [37.6176, 55.7558], zoom: lon != null ? 15 : 10 } });
    map.addChild(new Y.YMapDefaultSchemeLayer({})); map.addChild(new Y.YMapDefaultFeaturesLayer({}));
    map.addChild(new Y.YMapListener({ onClick: (_o: any, ev: any) => { const c = ev.coordinates; emit("update", c[1].toFixed(6), c[0].toFixed(6)); } }));
    if (lat != null && lon != null) setMarker(lat, lon, false);
  } catch (e: any) { mapErr.value = e.message; }
});
onBeforeUnmount(() => { try { map?.destroy(); } catch {} });
watch(() => [props.lat, props.lon], ([a, b]) => { const lat = num(a), lon = num(b); if (lat != null && lon != null) setMarker(lat, lon); });
</script>
<template>
  <div class="field"><label>Поиск по адресу <span class="muted">— найдём точку; для утраченных зданий поставьте её на карте вручную</span></label>
    <div style="position:relative">
      <div style="display:flex;gap:8px"><input class="inp" v-model="q" placeholder="Москва, Мясницкая, 21" autocomplete="off" @input="onType" @keydown.enter.prevent="sug = []; find()" @keydown.esc="sug = []"><button class="btn sm" :disabled="busy" @click="sug = []; find()">Найти</button></div>
      <div v-if="sug.length" style="position:absolute;left:0;right:0;top:100%;z-index:20;background:#fff;border:1px solid var(--line);box-shadow:0 6px 18px rgba(0,0,0,.08)">
        <div v-for="(s, i) in sug" :key="i" style="padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--line)" @click="pickSug(s)"><div style="font-size:13px">{{ s.title }}</div><div class="muted" style="font-size:12px">{{ s.subtitle }}</div></div>
      </div>
    </div>
    <div v-if="hits.length" class="metabox" style="margin-top:8px;padding:0 12px">
      <div v-for="(h, i) in hits" :key="i" class="r" style="cursor:pointer;padding:9px 0" @click="pick(h)"><span style="font-size:13px">{{ h.text }}</span><span class="muted" style="font-size:11px;white-space:nowrap">{{ h.precision === 'exact' ? 'дом' : h.kind }}</span></div>
    </div></div>
  <div class="field"><label>Точка на карте <span class="muted">— клик ставит, маркер можно перетащить</span></label>
    <div ref="box" style="height:300px;background:var(--fill);border:1px solid var(--line)"></div>
    <div v-if="mapErr" class="admbar err" style="margin:8px 0 0">{{ mapErr }}</div></div>
</template>
