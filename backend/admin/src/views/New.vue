<script setup lang="ts">
// Создание сущности: всё заполняется сразу — поля типа, связи, теги, файл; черновик по выбору
import { ref, reactive, computed } from "vue";
import { useRouter } from "vue-router";
import { S, api, load, toast, dictValues, subOptions, uploadFile } from "../lib/store";
import { TYPES, TYPEKEY, SUBKEY, TYPELABEL, SUBLABEL, DATEKEY, DATELABEL, DATEPH, SPECIFIC, SRCKIND, ACCESS, fmtSize, type Entity } from "../lib/model";
import Picker from "../components/Picker.vue";
const router = useRouter();
const f = reactive<Record<string, any>>({ type: "material", status: "published", srcKind: "text" });
// многозначные поля (функции, авторы, заказчики): массив строк из справочника
function toggleMulti(k: string, v: string) { const cur: string[] = Array.isArray(f[k]) ? [...f[k]] : []; const i = cur.indexOf(v); if (i < 0) cur.push(v); else cur.splice(i, 1); f[k] = cur; }
const nf = ref<HTMLInputElement>();
const links = ref<Entity[]>([]), tags = ref<string[]>([]), file = ref<File | null>(null), picker = ref<null | "link" | "tag">(null), newTag = ref(""), busy = ref(false);
const t = computed(() => f.type as string), tk = computed(() => TYPEKEY[t.value] || "subtype"), sk = computed(() => SUBKEY[t.value] || "subtype"), dk = computed(() => DATEKEY[t.value] || "date");
const rec = computed(() => t.value === "source" && f.srcKind === "record");
const typeVals = computed(() => (t.value === "person" && !dictValues("group").length ? ["Деятели эпохи", "Исследователи конструктивизма"] : dictValues(tk.value)));
const subVals = computed(() => subOptions(tk.value, f[tk.value]));
const pool = computed(() => S.raw.filter((x) => (picker.value === "tag" ? x.type === "tag" : !["media", "dict", "tag"].includes(x.type)) && !links.value.some((l) => l.id === x.id)));
async function create() {
  if (!String(f.title || "").trim()) return toast("Укажите название");
  busy.value = true;
  try {
    const { type, title, status, ...rest } = f;
    const payload: Record<string, any> = {}; for (const [k, v] of Object.entries(rest)) if (v) payload[k] = v;
    const tagIds: string[] = [];
    for (const name of tags.value) {
      let tag = S.raw.find((x) => x.type === "tag" && x.title.toLowerCase() === name.toLowerCase());
      if (!tag) tag = await api("/entities", { method: "POST", body: JSON.stringify({ type: "tag", title: name }) });
      tagIds.push(tag!.id);
    }
    const e = await api<Entity>("/entities", { method: "POST", body: JSON.stringify({ type, title: String(title).trim(), status: status || "published", payload, links: [...new Set([...links.value.map((l) => l.id), ...tagIds])] }) });
    if (file.value) await uploadFile(file.value, e.id);
    await load(); toast("Создано"); router.push("/edit/" + e.id);
  } catch (e: any) { toast("Ошибка: " + e.message); }
  busy.value = false;
}
const addTag = () => { const n = newTag.value.trim().replace(/^#/, ""); if (n && !tags.value.some((x) => x.toLowerCase() === n.toLowerCase())) tags.value.push(n); newTag.value = ""; picker.value = null; };
</script>
<template>
  <div class="crumbs"><router-link to="/entities">Сущности</router-link> / Новая</div>
  <h1 style="font-size:26px;letter-spacing:2px">Создать сущность</h1>
  <div class="two" style="max-width:960px">
    <div>
      <div class="field"><label>Сущность</label><select class="sel" v-model="f.type"><option v-for="x in Object.keys(TYPES).filter(x => x !== 'media')" :key="x" :value="x">{{ TYPES[x].l }}</option></select></div>
      <div v-if="t === 'source'" class="field"><label>Что это</label><div class="chips"><span v-for="(l, v) in SRCKIND" :key="v" class="fchip" :class="{ on: f.srcKind === v }" @click="f.srcKind = v">{{ l }}</span></div>
        <div class="muted" style="font-size:12px;margin-top:4px">Запись — короткая карточка без описания и файлов: только выходные данные.</div></div>
      <div class="field"><label>Название</label><input class="inp" v-model="f.title" placeholder="Название сущности"></div>
      <div class="field" v-if="t === 'theme'"><label>Тип</label><input class="inp" v-model="f[tk]"></div>
      <div class="field" v-else><label>{{ TYPELABEL[t] || "Тип" }}</label><select class="sel" v-model="f[tk]" @change="f[sk] = ''"><option value="">— не задано —</option><option v-for="v in typeVals" :key="v" :value="v">{{ v }}</option></select></div>
      <div class="field" v-if="!rec && t !== 'theme'"><label>{{ SUBLABEL[t] || "Подтип" }} <span class="muted">— из справочника, по выбранному типу</span></label><select class="sel" v-model="f[sk]"><option value="">— не задано —</option><option v-for="v in subVals" :key="v" :value="v">{{ v }}</option></select></div>
      <div class="field"><label>{{ DATELABEL[t] || "Дата / период" }}</label><input class="inp" v-model="f[dk]" :placeholder="DATEPH[t] || 'например 1927'"></div>
      <div class="field" v-if="t === 'material'"><label>Уровень доступа</label><div class="chips"><span v-for="(l, v) in ACCESS" :key="v" class="fchip" :class="{ on: f.access === v }" @click="f.access = f.access === v ? '' : v">{{ l }}</span></div></div>
      <div class="field" v-for="[k, l, ph] in SPECIFIC[t] || []" :key="k"><label>{{ l }}</label>
          <select v-if="ph && ph.startsWith('select:')" class="sel" v-model="f[k]"><option value="">—</option><option v-for="v in ph.slice(7).split('|')" :key="v" :value="v">{{ v }}</option></select>
          <template v-else-if="ph && ph.startsWith('dict:')"><input class="inp" v-model="f[k]" :list="'dl-' + k" placeholder="из справочника или новый"><datalist :id="'dl-' + k"><option v-for="v in dictValues(ph.slice(5))" :key="v" :value="v"></option></datalist></template>
          <select v-else-if="ph && ph.startsWith('dictsel:')" class="sel" v-model="f[k]"><option value="">—</option><option v-for="v in dictValues(ph.slice(8))" :key="v" :value="v">{{ v }}</option></select>
          <template v-else-if="ph && ph.startsWith('multi:')">
            <div class="muted" style="font-size:12px;margin-bottom:4px">Несколько значений — из справочника «{{ ph.slice(6) === 'func' ? 'Функции' : ph.slice(6) === 'author' ? 'Авторы' : 'Заказчики' }}» (клик отмечает)</div>
            <template v-if="dictValues('sub:' + ph.slice(6)).length"><div v-for="g in dictValues(ph.slice(6))" :key="g" style="margin-bottom:6px"><div class="kicker">{{ g }}</div>
              <div class="chips" style="margin-top:4px"><span v-for="v in dictValues('sub:' + ph.slice(6)).filter(x => x.startsWith(g + ' › '))" :key="v" class="fchip" :class="{ on: (f[k] || []).includes(v) }" @click="toggleMulti(k, v)">{{ v.slice(g.length + 3) }}</span></div></div></template>
            <div v-else class="chips"><span v-for="v in dictValues(ph.slice(6))" :key="v" class="fchip" :class="{ on: (f[k] || []).includes(v) }" @click="toggleMulti(k, v)">{{ v }}</span></div>
            <div v-if="!dictValues(ph.slice(6)).length" class="muted" style="font-size:12px">Справочник пуст — заполните его в разделе «Справочники».</div>
          </template>
          <input v-else class="inp" v-model="f[k]" :placeholder="ph || ''"></div>
      <div class="field" v-if="!rec"><label>Описание</label><textarea class="inp" v-model="f.desc" placeholder="Редакторское описание с научным аппаратом…"></textarea></div>
      <div class="field"><label>Публикация</label><div class="chips"><span class="fchip" :class="{ on: f.status === 'published' }" @click="f.status = 'published'">Опубликовать сразу</span><span class="fchip" :class="{ on: f.status === 'draft' }" @click="f.status = 'draft'">Создать черновиком</span></div>
        <div class="muted" style="font-size:12px;margin-top:4px">Черновик не виден на публичном сайте — можно доработать и опубликовать позже.</div></div>
      <div style="display:flex;gap:10px;margin-top:20px"><button class="btn dark" :disabled="busy" @click="create">Создать</button><router-link class="btn" to="/entities">Отмена</router-link></div>
    </div>
    <div>
      <h3 style="margin-top:0">Связи</h3>
      <div class="muted" style="font-size:13px;margin-bottom:8px">Двусторонние: появятся на карточках обеих сущностей.</div>
      <div class="chips" style="margin-bottom:10px"><span v-for="x in links" :key="x.id" class="chip">{{ x.title }} <span class="muted" style="font-size:11px">· {{ TYPES[x.type]?.l }}</span><span class="x" @click="links = links.filter(l => l.id !== x.id)">✕</span></span>
        <span class="chip add" @click="picker = 'link'">＋ добавить связь</span></div>
      <h3>Теги <span class="muted" style="font-size:12px;font-weight:400;letter-spacing:0;text-transform:none">— служебные, для поиска</span></h3>
      <div class="chips"><span v-for="x in tags" :key="x" class="chip">#{{ x }}<span class="x" @click="tags = tags.filter(y => y !== x)">✕</span></span><span class="chip add" @click="picker = 'tag'">＋ тег</span></div>
      <template v-if="!rec">
        <h3>Медиа</h3>
        <input type="file" ref="nf" accept="image/*,application/pdf,video/*,audio/*" style="display:none" @change="file = ($event.target as HTMLInputElement).files?.[0] || null">
        <div v-if="file" style="font-size:13px;margin-bottom:8px">{{ file.name }} · {{ fmtSize(file.size) }} <span class="lnk" @click="file = null">✕</span></div>
        <button class="btn sm" @click="nf?.click()">＋ Загрузить файл</button>
        <div class="muted" style="font-size:12px;margin-top:8px">Файл загрузится сразу после создания и прикрепится к сущности. Файлы из медиатеки можно прикрепить в карточке.</div>
      </template>
    </div>
  </div>
  <Picker v-if="picker === 'link'" title="Добавить связь" :items="pool" typed @pick="links.push($event); picker = null" @close="picker = null" />
  <Picker v-if="picker === 'tag'" title="Добавить тег" :items="pool" @pick="tags.push($event.title); picker = null" @close="picker = null">
  </Picker>
  <div v-if="picker === 'tag'" style="position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:60;background:#fff;padding:10px 14px;border:1px solid var(--line);display:flex;gap:8px;align-items:center">
    <input class="inp" style="width:260px" placeholder="Новый тег" v-model="newTag" @keydown.enter="addTag"><button class="btn sm dark" @click="addTag">Создать</button>
  </div>
</template>
