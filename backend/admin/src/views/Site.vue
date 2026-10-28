<script setup lang="ts">
// Тексты сайта: поиск, хронограф, ссылки меню и футера, соцсети (тексты главной — в разделе «Главная страница»)
import { reactive, ref } from "vue";
import { siteVal, patchSite, toast, canEdit, chronoVal, saveChrono, uploadFile, S } from "../lib/store";
// диапазон лет таймлайна хронографа (задаётся отдельно от периода поиска)
const chr = ref(chronoVal());
async function saveChr() { const a = Number(chr.value.from), b = Number(chr.value.to); if (!a || !b || a > b) return toast("Укажите годы «с» и «по», например 1920 и 1935"); try { await saveChrono(a, b); toast("Сохранено — таймлайн обновлён"); } catch (e: any) { toast("Ошибка: " + e.message); } }
import { SITE_DEF } from "../lib/model";
const f = reactive<Record<string, string>>({});
SITE_DEF.flatMap((g) => g[1]).forEach(([k]) => (f[k] = siteVal(k)));
// картинка превью ссылок (og:image) для страниц без обложки: главная, поиск, разделы, хронограф, карта. 1200×630
const ogInput = ref<HTMLInputElement>();
async function ogImg(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]; (ev.target as HTMLInputElement).value = ""; if (!file) return;
  try { if (!S.db["site"]) await patchSite({}); const m = await uploadFile(file, "site"); await patchSite({ ogImage: m.big || m.med || m.thumb || "" }); toast("Сохранено"); } catch (e: any) { toast("Ошибка: " + e.message); }
}
async function save() { try { await patchSite(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim()]))); toast("Сохранено — тексты обновлены на сайте"); } catch (e: any) { toast("Ошибка: " + e.message); } }
</script>
<template>
  <h1>Тексты сайта</h1>
  <div class="muted" style="font-size:14px;margin:6px 0 18px;max-width:720px">Тексты поиска, карты и хронографа, ссылки в меню и футере, соцсети, описания разделов и SEO. Тексты главной — в разделе «Главная страница». Сохранённое сразу появляется на сайте.</div>
  <div class="grid g2" style="gap:16px;align-items:start">
    <div v-for="[title, fields] in SITE_DEF" :key="title" class="card"><b>{{ title }}</b>
      <div v-for="[k, l, , ta] in fields" :key="k" class="field" style="margin-top:10px"><label>{{ l }}</label>
        <textarea v-if="ta" class="inp" v-model="f[k]" style="min-height:96px" :disabled="!canEdit"></textarea><input v-else class="inp" v-model="f[k]" :disabled="!canEdit"></div>
      <div v-if="title === 'SEO'" class="field" style="margin-top:10px"><label>Картинка превью ссылок <span class="muted">— для главной и страниц без обложки, 1200×630; у карточек превью — их обложка</span></label>
        <div class="media" :style="{ aspectRatio: '1200/630', maxHeight: '160px', backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundImage: siteVal('ogImage') ? `url('${siteVal('ogImage')}')` : '' }"></div>
        <div v-if="canEdit" style="display:flex;gap:8px;margin-top:8px"><input type="file" accept="image/*" style="display:none" ref="ogInput" @change="ogImg"><button class="btn sm" @click="ogInput?.click()">＋ Загрузить</button><button v-if="siteVal('ogImage')" class="btn sm" @click="patchSite({ ogImage: '' })">Убрать</button></div>
        <div class="muted" style="font-size:12px;margin-top:10px">Коды подтверждения и номер счётчика работают только на основном домене archive.centrezotov.ru; на тестовом стенде не подставляются.</div></div>
      <div v-if="title === 'Хронограф'" class="field" style="margin-top:10px"><label>Диапазон лет таймлайна <span class="muted">— все годы в ряд; годы без событий — неактивные</span></label>
        <div style="display:flex;gap:8px;align-items:center"><span>с</span><input class="inp" v-model="chr.from" inputmode="numeric" style="width:100px" placeholder="1920" :disabled="!canEdit"><span>по</span><input class="inp" v-model="chr.to" inputmode="numeric" style="width:100px" placeholder="1935" :disabled="!canEdit"><button v-if="canEdit" class="btn sm" @click="saveChr">Сохранить</button></div>
        <div v-if="!chronoVal().from" class="muted" style="font-size:12px;margin-top:6px">Пока не задан — по датам событий.</div></div>
    </div>
  </div>
  <div v-if="canEdit" style="display:flex;gap:10px;margin-top:20px"><button class="btn dark" @click="save">Сохранить</button></div>
</template>
