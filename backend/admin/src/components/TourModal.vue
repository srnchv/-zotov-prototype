<script setup lang="ts">
// 3D-тур: папка от студии (index.html + ресурсы, хоть гигабайты) заливается из браузера файл за файлом в наше хранилище —
// тур живёт у нас. Загрузка идёт и при закрытом окне, прогресс виден в карточке. Либо ZIP до 2 ГБ, либо ссылка / код эмбеда.
import { ref, computed, onMounted } from "vue";
import Modal from "./Modal.vue";
import { S, api, load, toast } from "../lib/store";
import { fmtSize } from "../lib/model";
import { JOB, startJob, retryJob, jobText, rel } from "../lib/tourJob";
const props = defineProps<{ parentId: string }>();
const emit = defineEmits<{ close: [] }>();
const mode = ref<"dir" | "zip" | "link">("dir");
const title = ref(""), code = ref(""), file = ref<File | null>(null), busy = ref(false), progress = ref("");
const dirFiles = ref<File[]>([]), resumeId = ref("");
const inpZip = ref<HTMLInputElement>(), inpDir = ref<HTMLInputElement>();
const API = import.meta.env.VITE_API_URL || "/api";
// незавершённые загрузки этого тура у сущности — докачиваются, а не заливаются заново
const pending = computed(() => (S.db[props.parentId]?.links || []).map((id) => S.db[id]).filter((m) => m && m.type === "media" && m.kind === "tour" && m.uploading));
onMounted(() => { if (pending.value.length) resumeId.value = pending.value[pending.value.length - 1].id; });
const job = computed(() => (JOB.cur && JOB.cur.parentId === props.parentId ? JOB.cur : null));
const plan = computed(() => {
  const all = dirFiles.value.filter((f) => !/(^|\/)(\.|__MACOSX)/.test(rel(f)));
  const idx = all.map(rel).filter((n) => /(^|\/)index\.html?$/i.test(n)).sort((a, b) => a.split("/").length - b.split("/").length)[0];
  if (!idx) return null;
  const root = idx.slice(0, idx.lastIndexOf("/") + 1);
  const files = all.filter((f) => rel(f).startsWith(root));
  return { root, index: idx.slice(root.length), files, size: files.reduce((a, f) => a + f.size, 0) };
});
function pickDir(ev: Event) { dirFiles.value = [...((ev.target as HTMLInputElement).files || [])]; if (!title.value && plan.value) title.value = plan.value.root.split("/").filter(Boolean).pop() || ""; }
async function uploadDir() {
  const p = plan.value; if (!p) return;
  try { await startJob({ parentId: props.parentId, title: title.value.trim() || "3D-тур", files: p.files, root: p.root, index: p.index, tourId: resumeId.value || undefined }); }
  catch (e: any) { toast(e.message); }
}
function uploadZip() {
  if (!file.value) return;
  busy.value = true; progress.value = "Загружаем архив…";
  const fd = new FormData(); fd.append("file", file.value); fd.append("entityId", props.parentId); if (title.value.trim()) fd.append("title", title.value.trim());
  const xhr = new XMLHttpRequest(); xhr.open("POST", API + "/tours");
  const t = localStorage.getItem("zadm_token"); if (t) xhr.setRequestHeader("authorization", "Bearer " + t);
  xhr.upload.onprogress = (e) => { if (e.lengthComputable) progress.value = e.loaded >= e.total ? "Распаковываем в хранилище — это может занять пару минут…" : `Загружаем архив: ${Math.round((e.loaded / e.total) * 100)}%`; };
  xhr.onload = async () => { busy.value = false; if (xhr.status < 300) { await load(); toast("3D-тур распакован и добавлен в галерею"); emit("close"); } else { let msg = "HTTP " + xhr.status; try { msg = JSON.parse(xhr.responseText).error || msg; } catch {} toast("Ошибка: " + msg); progress.value = ""; } };
  xhr.onerror = () => { busy.value = false; progress.value = ""; toast("Ошибка сети при загрузке"); };
  xhr.send(fd);
}
async function saveLink() {
  const m = code.value.match(/src\s*=\s*["']([^"']+)["']/i);
  const src = (m ? m[1] : code.value).trim();
  if (!/^https:\/\//i.test(src)) { toast("Нужна ссылка вида https://… или код с iframe"); return; }
  busy.value = true;
  try { await api("/entities", { method: "POST", body: JSON.stringify({ type: "media", title: title.value.trim() || "3D-тур", payload: { kind: "tour", embed: src, parent: props.parentId }, links: [props.parentId] }) }); await load(); toast("3D-тур добавлен в галерею"); emit("close"); }
  catch (e: any) { toast("Ошибка: " + e.message); }
  busy.value = false;
}
</script>
<template>
  <Modal title="3D-тур" @close="emit('close')">
    <div class="chips" style="margin-top:8px">
      <span class="fchip" :class="{ on: mode === 'dir' }" @click="mode = 'dir'">Папка тура</span>
      <span class="fchip" :class="{ on: mode === 'zip' }" @click="mode = 'zip'">ZIP до 2 ГБ</span>
      <span class="fchip" :class="{ on: mode === 'link' }" @click="mode = 'link'">Ссылка или код эмбеда</span>
    </div>
    <template v-if="mode === 'dir'">
      <!-- идёт или остановилась загрузка — показываем её, новую не даём начать -->
      <template v-if="job">
        <div class="field"><label>{{ job.title }}</label>
          <div class="admbar" :class="{ err: !!job.error, warn: !job.error && !job.running }" style="margin:0">{{ job.error || jobText(job) }}</div>
          <div style="background:var(--fill);height:8px;margin-top:8px"><div style="background:var(--ink);height:8px;transition:width .3s" :style="{ width: Math.round(((job.skipped + job.done) / Math.max(1, job.total)) * 100) + '%' }"></div></div>
          <div class="muted" style="font-size:12px;margin-top:6px">Окно можно закрыть — загрузка продолжится, пока открыта вкладка админки. Прогресс виден в карточке.</div></div>
        <div class="right"><button v-if="!job.running && job.failed.length" class="btn dark" @click="retryJob">Догрузить {{ job.failed.length }}</button><button v-if="!job.running && !job.failed.length && job.error" class="btn" @click="JOB.cur = null">Сбросить</button><button class="btn" @click="emit('close')">Закрыть</button></div>
      </template>
      <template v-else>
        <div class="field"><label>Название</label><input class="inp" v-model="title" placeholder="3D-тур по выставке"></div>
        <div class="field"><label>Распакованная папка тура от студии (с index.html внутри)</label>
          <input type="file" ref="inpDir" webkitdirectory directory multiple style="display:none" @change="pickDir">
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <button class="btn sm" @click="inpDir?.click()">Выбрать папку</button>
            <span v-if="plan" style="font-size:13px">{{ plan.files.length }} файлов · {{ fmtSize(plan.size) }} · старт: {{ plan.index }}</span>
            <span v-else-if="dirFiles.length" style="font-size:13px;color:#9a2e2e">В папке нет index.html</span>
          </div></div>
        <div v-if="pending.length" class="field"><label>Незавершённая загрузка найдена — докачаем недостающие файлы в неё</label>
          <select class="sel" v-model="resumeId"><option value="">— нет, начать заново —</option><option v-for="t in pending" :key="t.id" :value="t.id">{{ t.title }} ({{ t.id }})</option></select></div>
        <div class="muted" style="font-size:12px">Файлы уходят в хранилище архива по одному, можно гигабайтами — тур будет жить у нас. После запуска окно можно закрыть, вкладку админки — нет.</div>
        <div class="right"><button class="btn" @click="emit('close')">Отмена</button><button class="btn dark" :disabled="!plan" @click="uploadDir">{{ resumeId ? "Докачать" : "Загрузить" }}</button></div>
      </template>
    </template>
    <template v-else-if="mode === 'zip'">
      <div class="field"><label>Название</label><input class="inp" v-model="title" placeholder="3D-тур по выставке" :disabled="busy"></div>
      <div class="field"><label>Архив (ZIP с index.html внутри)</label>
        <input type="file" ref="inpZip" accept=".zip,application/zip" style="display:none" @change="file = ($event.target as HTMLInputElement).files?.[0] || null">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button class="btn sm" :disabled="busy" @click="inpZip?.click()">Выбрать файл</button><span v-if="file" style="font-size:13px">{{ file.name }} · {{ fmtSize(file.size) }}</span></div>
        <div class="muted" style="font-size:12px;margin-top:6px">Для архивов больше 2 ГБ используйте «Папка тура».</div></div>
      <div v-if="progress" class="admbar" style="margin:0 0 8px">{{ progress }}</div>
      <div class="right"><button class="btn" :disabled="busy" @click="emit('close')">Отмена</button><button class="btn dark" :disabled="busy || !file || file.size > 2 * 1024 ** 3" @click="uploadZip">Загрузить</button></div>
    </template>
    <template v-else>
      <div class="field"><label>Название</label><input class="inp" v-model="title" placeholder="3D-тур по выставке"></div>
      <div class="field"><label>Код эмбеда или ссылка</label><textarea class="inp" v-model="code" style="font-family:monospace;font-size:12px" placeholder='<iframe src="https://my.matterport.com/show/?m=…" …></iframe>'></textarea>
        <div class="muted" style="font-size:12px;margin-top:4px">Matterport, Kuula, 3DVista и т.п. Берём из кода только адрес.</div></div>
      <div class="right"><button class="btn" @click="emit('close')">Отмена</button><button class="btn dark" :disabled="busy" @click="saveLink">Добавить</button></div>
    </template>
  </Modal>
</template>
