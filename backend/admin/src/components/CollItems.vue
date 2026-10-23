<script setup lang="ts">
// Настройки материалов в коллекции (привязка «материал в коллекции»): фото из изображений материала,
// подпись (по умолчанию — название), галочка «Хайлайт» для галереи на главной. У другой коллекции — свои настройки.
import { reactive, watch } from "vue";
import { S, collMaterials, collItems } from "../lib/store";
import { kindOf, type Entity } from "../lib/model";
const props = defineProps<{ coll: Entity }>();
const emit = defineEmits<{ change: [items: Record<string, { img: string; caption: string; hl: boolean }>] }>();
const mats = () => collMaterials(props.coll);
const imgsOf = (m: Entity) => (m.links || []).map((id) => S.db[id]).filter((x) => x && x.type === "media" && kindOf(x) === "image");
const st = reactive<Record<string, { img: string; caption: string; hl: boolean }>>({});
function init() {
  const items = collItems(props.coll);
  for (const k of Object.keys(st)) delete st[k];
  for (const m of mats()) { const it = items[m.id] || {}; const imgs = imgsOf(m); st[m.id] = { img: it.img || m.cover || imgs[0]?.id || "", caption: it.caption || "", hl: !!it.hl }; }
}
init();
watch(() => props.coll, init);
watch(st, () => emit("change", JSON.parse(JSON.stringify(st))), { deep: true, immediate: true });
const thumb = (id: string) => (S.db[id]?.thumb ? `background-image:url('${S.db[id].thumb}')` : "");
// подпись файла (название, автор, год) — заполняется в карточке материала
const fileCap = (id: string) => { const f = S.db[id]; if (!f) return ""; return [f.caption, [f.author, f.year].filter(Boolean).join(", ")].filter(Boolean).join(" — "); };
</script>
<template>
  <div v-if="!mats().length" class="muted" style="font-size:13px;margin:8px 0">Добавьте материалы в коллекцию (блок «Связи») — здесь появятся их настройки.</div>
  <template v-else>
    <div class="kicker" style="margin:10px 0 6px">Материалы коллекции <span class="muted" style="letter-spacing:0;text-transform:none">— фото и подпись для этой коллекции, галочка хайлайта для галереи на главной</span></div>
    <div v-for="m in mats()" :key="m.id" style="display:grid;grid-template-columns:44px 1fr auto;gap:10px;align-items:center;padding:8px 0;border-top:1px solid var(--line)">
      <span class="thumbmini" :style="thumb(st[m.id].img)"></span>
      <div style="min-width:0">
        <div style="font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ m.title }}</div>
        <div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap">
          <select class="sel inline" style="max-width:220px" v-model="st[m.id].img" :disabled="!imgsOf(m).length">
            <option v-if="!imgsOf(m).length" value="">нет изображений</option>
            <option v-for="x in imgsOf(m)" :key="x.id" :value="x.id">{{ x.title }}</option>
          </select>
          <input class="inp" style="font-size:12px;padding:3px 8px;flex:1;min-width:160px;width:auto" :placeholder="'Подпись для этой коллекции (по умолчанию — ' + (fileCap(st[m.id].img) ? '«' + fileCap(st[m.id].img) + '»' : 'название материала') + ')'" v-model="st[m.id].caption">
        </div>
      </div>
      <label class="check" style="margin:0;white-space:nowrap;font-size:12px"><input type="checkbox" v-model="st[m.id].hl"> Хайлайт</label>
    </div>
  </template>
</template>
