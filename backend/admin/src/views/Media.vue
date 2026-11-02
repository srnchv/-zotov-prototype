<script setup lang="ts">
import { ask, askInput } from "../lib/dialog";
// Медиатека: общее хранилище файлов; файл прикрепляется к сущностям связями
import { ref, computed, watch, onUnmounted } from "vue";
import { S, all, api, load, toast, uploadFile, canEdit } from "../lib/store";
import { kindOf, fmtSize } from "../lib/model";
const kind = ref("all"), status = ref(""), inp = ref<HTMLInputElement>();
const KINDS: [string, string][] = [["all", "Все"], ["image", "Фото"], ["video", "Видео"], ["audio", "Аудио"], ["tour", "3D-туры"], ["doc", "Документы"]];
const files = computed(() => all("media").filter((f) => kind.value === "all" || kindOf(f) === kind.value));
const cnt = (k: string) => (k === "all" ? all("media").length : all("media").filter((f) => kindOf(f) === k).length);
const total = computed(() => files.value.reduce((a, f) => a + (typeof f.size === "number" ? f.size : 0), 0));
let timer: ReturnType<typeof setInterval> | null = null;
watch(() => all("media").some((f) => ["queued", "processing"].includes(String(f.hlsStatus || ""))), (busy) => { if (busy && !timer) timer = setInterval(() => load(), 5000); if (!busy && timer) { clearInterval(timer); timer = null; } }, { immediate: true });
onUnmounted(() => { if (timer) clearInterval(timer); });
// очередь конвертации видео: что кодируется сейчас, что ждёт; остановить/снять, запустить заново
type QState = { ffmpeg: boolean; running: boolean; queued: string[]; current: { id: string; stage: string; sinceSec: number; lastLog: string } };
const qs = ref<QState | null>(null);
async function loadQ() { try { qs.value = await api<QState>("/transcode/status"); } catch { qs.value = null; } }
loadQ(); const qTimer = setInterval(loadQ, 5000); onUnmounted(() => clearInterval(qTimer));
const videos = computed(() => all("media").filter((f) => kindOf(f) === "video"));
const qItems = computed(() => videos.value.filter((f) => ["queued", "processing"].includes(String(f.hlsStatus || ""))).sort((a, b) => (a.hlsStatus === "processing" ? -1 : 0) - (b.hlsStatus === "processing" ? -1 : 0)));
const STAGE: Record<string, string> = { start: "запуск", download: "скачиваем оригинал", probe: "читаем параметры", encode: "кодируем", upload: "выгружаем в хранилище", done: "готово", error: "ошибка", cancelled: "остановлено" };
const fmtDur = (sec: number) => (sec < 60 ? sec + " с" : Math.round(sec / 60) + " мин");
async function cancelQ(f: any) { if (!(await ask(f.hlsStatus === "processing" ? "Остановить конвертацию" : "Снять с очереди", `«${f.title}» — ${f.hlsStatus === "processing" ? "процесс будет остановлен, уже сделанное пропадёт" : "файл будет снят с очереди"}. Запустить заново можно в карточке файла.`, { ok: f.hlsStatus === "processing" ? "Остановить" : "Снять", danger: true }))) return; try { await api("/transcode/cancel", { method: "POST", body: JSON.stringify({ id: f.id }) }); await load(); await loadQ(); } catch (e: any) { toast("Ошибка: " + e.message); } }
async function retry(f: any) { try { await api("/media/" + f.id + "/transcode", { method: "POST" }); await load(); await loadQ(); toast("Поставлено в очередь"); } catch (e: any) { toast("Ошибка: " + e.message); } }
const parents = (f: any) => (f.links || []).map((id: string) => S.db[id]).filter((x: any) => x && x.type !== "media");
async function onFile() { const file = inp.value?.files?.[0]; if (!file) return; status.value = "Загрузка…"; try { await uploadFile(file); await load(); toast("Файл загружен"); } catch (e: any) { toast("Ошибка: " + e.message); } status.value = ""; if (inp.value) inp.value.value = ""; }
async function del(id: string) { if (!(await ask("Удалить файл", "Файл пропадёт из всех карточек.", { ok: "Удалить", danger: true }))) return; try { await api("/entities/" + id, { method: "DELETE" }); await load(); toast("Удалено"); } catch (e: any) { toast("Ошибка: " + e.message); } }
</script>
<template>
  <div style="display:flex;justify-content:space-between;align-items:baseline;gap:16px;flex-wrap:wrap"><h1>Медиатека</h1>
    <span v-if="canEdit" style="display:flex;align-items:center;gap:10px"><input type="file" ref="inp" accept="image/*,application/pdf,video/*,audio/*" style="display:none" @change="onFile"><span class="muted" style="font-size:12px">{{ status }}</span><button class="btn dark" @click="inp?.click()">＋ Загрузить в архив</button></span></div>
  <div class="muted" style="font-size:13px;margin-top:6px">Общее хранилище файлов архива. Файл прикрепляется к сущностям связями — один и тот же файл может относиться к нескольким карточкам.<template v-if="files.length"> Показано: {{ files.length }} · {{ fmtSize(total) }}</template></div>
  <div v-if="qItems.length || videos.some(f => f.hlsStatus === 'error') || (qs && !qs.ffmpeg)" class="card" style="margin-top:14px">
    <b>Конвертация видео</b> <span class="muted" style="font-size:12px">— по одному файлу, остальные ждут</span>
    <div v-if="qs && !qs.ffmpeg" class="admbar err" style="margin-top:8px">На сервере нет ffmpeg — конвертация невозможна, нужен новый образ API.</div>
    <div v-if="qItems.length" class="metabox" style="margin-top:8px">
      <div v-for="(f, i) in qItems" :key="f.id" class="r" style="align-items:center;gap:12px">
        <span class="k" style="flex:0 0 28px">{{ f.hlsStatus === 'processing' ? '▶' : i + (qItems[0].hlsStatus === 'processing' ? 0 : 1) }}</span>
        <span class="v" style="flex:1;text-align:left;min-width:0"><router-link :to="'/edit/' + f.id">{{ f.title }}</router-link> <span class="muted" style="font-size:12px">· {{ fmtSize(f.size) }}</span>
          <div style="font-size:12px" class="muted">{{ f.hlsStatus === 'processing' ? `${f.hlsStage || 'кодируем'} · ${f.hlsProgress || 0}%` + (qs && qs.current.id === f.id ? ` · этап ${STAGE[qs.current.stage] || qs.current.stage} уже ${fmtDur(qs.current.sinceSec)}` : '') : 'ждёт' }}</div>
          <div v-if="f.hlsStatus === 'processing'" class="upbar" style="margin:6px 0 0;height:8px"><div class="upfill" :style="{ width: (f.hlsProgress || 0) + '%', background: '#262626' }"></div></div></span>
        <span v-if="canEdit" class="lnk" style="font-size:12px;color:#9a2e2e;white-space:nowrap" @click="cancelQ(f)">{{ f.hlsStatus === 'processing' ? 'Остановить' : 'Снять с очереди' }}</span>
      </div>
    </div>
    <div v-if="qs && qs.running && !qItems.length" class="muted" style="font-size:12px;margin-top:8px">Очередь занята заданием {{ qs.current.id }} (этап {{ STAGE[qs.current.stage] || qs.current.stage }}, {{ fmtDur(qs.current.sinceSec) }}) — если это зависло, снимите его в карточке файла.</div>
    <template v-if="videos.some(f => f.hlsStatus === 'error')">
      <div class="kicker" style="margin-top:12px">С ошибкой</div>
      <div v-for="f in videos.filter(f => f.hlsStatus === 'error')" :key="f.id" style="font-size:13px;margin-top:6px;display:flex;gap:10px;align-items:baseline;flex-wrap:wrap"><router-link :to="'/edit/' + f.id">{{ f.title }}</router-link><span class="muted" style="font-size:12px">{{ f.hlsError }}</span><span v-if="canEdit" class="lnk" style="font-size:12px" @click="retry(f)">Запустить заново</span></div>
    </template>
  </div>
  <div class="chips" style="margin:12px 0"><span v-for="[k, l] in KINDS" :key="k" class="chip" :class="{ on: kind === k }" @click="kind = k">{{ l }} <span style="opacity:.6">{{ cnt(k) }}</span></span></div>
  <div v-if="files.length" class="grid g4" style="margin-top:16px">
    <div v-for="f in files" :key="f.id" class="card click" style="padding:14px;position:relative" @click="$router.push('/edit/' + f.id)">
      <span v-if="canEdit" title="Удалить файл" style="position:absolute;top:8px;right:10px;color:#9a2e2e;cursor:pointer;z-index:2" @click.stop="del(f.id)">✕</span>
      <div class="media" style="margin-bottom:10px" :style="f.thumb ? { backgroundImage: `url('${f.thumb}')` } : {}"></div>
      <div style="font-size:13px;font-weight:500;word-break:break-all">{{ f.title }}</div>
      <div class="muted" style="font-size:12px">{{ kindOf(f) === 'tour' ? '3D-тур' : (f.format || '') }}<template v-if="f.size"> · {{ fmtSize(f.size) }}</template></div>
      <div v-if="kindOf(f) === 'video'" style="font-size:11px;margin-top:4px" :style="f.hlsStatus === 'error' ? 'color:#9a2e2e' : f.hlsStatus === 'done' ? '' : 'color:#b8860b'">{{ f.hlsStatus === 'done' ? 'адаптивное: ' + (f.hlsLevels || []).map((h: number) => h + 'p').join('/') : f.hlsStatus === 'processing' ? 'конвертируется ' + (f.hlsProgress || 0) + '%' + (f.hlsStage ? ' · ' + f.hlsStage : '') : f.hlsStatus === 'queued' ? 'в очереди на конвертацию' : f.hlsStatus === 'error' ? 'ошибка конвертации' : 'одно качество' }}</div>
      <div v-if="parents(f).length" class="muted" style="font-size:11px;margin-top:8px">Прикреплён: {{ parents(f).map((x: any) => x.title).join(', ') }}</div>
      <div v-else style="font-size:11px;margin-top:8px;color:#b8860b">Не прикреплён к сущностям</div>
    </div>
  </div>
  <p v-else class="muted" style="margin-top:24px">{{ kind === 'all' ? 'Файлов пока нет. Загрузите первый — он появится здесь, и его можно будет прикрепить к любой сущности.' : 'В этом разделе файлов нет.' }}</p>
</template>
