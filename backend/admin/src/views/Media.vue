<script setup lang="ts">
// Медиатека: общее хранилище файлов; файл прикрепляется к сущностям связями
import { ref, computed } from "vue";
import { S, all, api, load, toast, uploadFile, canEdit, isAdmin, siteVal, patchSite } from "../lib/store";
import { kindOf, fmtSize } from "../lib/model";
const kind = ref("all"), status = ref(""), inp = ref<HTMLInputElement>();
const KINDS: [string, string][] = [["all", "Все"], ["image", "Фото"], ["video", "Видео"], ["audio", "Аудио"], ["tour", "3D-туры"], ["doc", "Документы"]];
const files = computed(() => all("media").filter((f) => kind.value === "all" || kindOf(f) === kind.value));
const cnt = (k: string) => (k === "all" ? all("media").length : all("media").filter((f) => kindOf(f) === k).length);
const total = computed(() => files.value.reduce((a, f) => a + (typeof f.size === "number" ? f.size : 0), 0));
const parents = (f: any) => (f.links || []).map((id: string) => S.db[id]).filter((x: any) => x && x.type !== "media");
async function onFile() { const file = inp.value?.files?.[0]; if (!file) return; status.value = "Загрузка…"; try { await uploadFile(file); await load(); toast("Файл загружен"); } catch (e: any) { toast("Ошибка: " + e.message); } status.value = ""; if (inp.value) inp.value.value = ""; }
// защита изображений: водяной знак (текст) на копиях для сайта; пересборка применяет его ко всем уже загруженным
const wm = ref(siteVal("wmText")), busyWm = ref(false), wmLog = ref("");
async function saveWm() { try { await patchSite({ wmText: wm.value.trim() }); toast("Сохранено — применится к новым загрузкам; для старых нажмите «Пересобрать копии»"); } catch (e: any) { toast("Ошибка: " + e.message); } }
async function reprocess() {
  if (!confirm("Пересобрать копии всех изображений и закрыть оригиналы? Это займёт время, сайт работает как обычно.")) return;
  busyWm.value = true; wmLog.value = "";
  try { const r = await api<any>("/media/reprocess", { method: "POST" }); wmLog.value = `Готово: файлов ${r.total}, оригиналов закрыто ${r.moved}, копий пересобрано ${r.redone}, ошибок ${r.failed}` + (r.log?.length ? "\n" + r.log.join("\n") : ""); await load(); }
  catch (e: any) { wmLog.value = "Ошибка: " + e.message; }
  busyWm.value = false;
}
async function del(id: string) { if (!confirm("Удалить файл из архива? Файл пропадёт из всех карточек.")) return; try { await api("/entities/" + id, { method: "DELETE" }); await load(); toast("Удалено"); } catch (e: any) { toast("Ошибка: " + e.message); } }
</script>
<template>
  <div v-if="isAdmin" class="card" style="margin-bottom:16px"><b>Защита изображений</b>
    <div class="muted" style="font-size:12px;margin:4px 0 10px;max-width:760px">Оригиналы хранятся закрыто и на сайт не попадают: показываются копии не шире 1600 px. Новые загрузки обрабатываются сразу; кнопка ниже — для файлов, загруженных раньше.</div>
    <!-- водяной знак (wm/saveWm) временно скрыт: на сервере нет шрифта с кириллицей, текст рисуется неверно; включим после установки шрифта в образ -->
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button class="btn dark" :disabled="busyWm" @click="reprocess">{{ busyWm ? "Пересобираем…" : "Пересобрать копии и закрыть оригиналы" }}</button></div>
    <pre v-if="wmLog" class="muted" style="font-size:12px;white-space:pre-wrap;margin:8px 0 0">{{ wmLog }}</pre>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:baseline;gap:16px;flex-wrap:wrap"><h1>Медиатека</h1>
    <span v-if="canEdit" style="display:flex;align-items:center;gap:10px"><input type="file" ref="inp" accept="image/*,application/pdf,video/*,audio/*" style="display:none" @change="onFile"><span class="muted" style="font-size:12px">{{ status }}</span><button class="btn dark" @click="inp?.click()">＋ Загрузить в архив</button></span></div>
  <div class="muted" style="font-size:13px;margin-top:6px">Общее хранилище файлов архива. Файл прикрепляется к сущностям связями — один и тот же файл может относиться к нескольким карточкам.<template v-if="files.length"> Показано: {{ files.length }} · {{ fmtSize(total) }}</template></div>
  <div class="chips" style="margin:12px 0"><span v-for="[k, l] in KINDS" :key="k" class="chip" :class="{ on: kind === k }" @click="kind = k">{{ l }} <span style="opacity:.6">{{ cnt(k) }}</span></span></div>
  <div v-if="files.length" class="grid g4" style="margin-top:16px">
    <div v-for="f in files" :key="f.id" class="card click" style="padding:14px;position:relative" @click="$router.push('/edit/' + f.id)">
      <span v-if="canEdit" title="Удалить файл" style="position:absolute;top:8px;right:10px;color:#9a2e2e;cursor:pointer;z-index:2" @click.stop="del(f.id)">✕</span>
      <div class="media" style="margin-bottom:10px" :style="f.thumb ? { backgroundImage: `url('${f.thumb}')` } : {}"></div>
      <div style="font-size:13px;font-weight:500;word-break:break-all">{{ f.title }}</div>
      <div class="muted" style="font-size:12px">{{ kindOf(f) === 'tour' ? '3D-тур' : (f.format || '') }}<template v-if="f.size"> · {{ fmtSize(f.size) }}</template></div>
      <div v-if="parents(f).length" class="muted" style="font-size:11px;margin-top:8px">Прикреплён: {{ parents(f).map((x: any) => x.title).join(', ') }}</div>
      <div v-else style="font-size:11px;margin-top:8px;color:#b8860b">Не прикреплён к сущностям</div>
    </div>
  </div>
  <p v-else class="muted" style="margin-top:24px">{{ kind === 'all' ? 'Файлов пока нет. Загрузите первый — он появится здесь, и его можно будет прикрепить к любой сущности.' : 'В этом разделе файлов нет.' }}</p>
</template>
