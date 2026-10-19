<script setup lang="ts">
// 3D-тур: папка от студии (index.html + ресурсы, хоть гигабайты) заливается из браузера файл за файлом в наше хранилище —
// тур живёт у нас. Небольшой ZIP (до 2 ГБ) можно отдать целиком. Либо ссылка / код эмбеда внешнего сервиса.
import { ref, computed } from "vue";
import Modal from "./Modal.vue";
import { api, load, toast } from "../lib/store";
import { fmtSize } from "../lib/model";
const props = defineProps<{ parentId: string }>();
const emit = defineEmits<{ close: [] }>();
const mode = ref<"dir" | "zip" | "link">("dir");
const title = ref(""), code = ref(""), file = ref<File | null>(null), busy = ref(false), progress = ref("");
const dirFiles = ref<File[]>([]);
const inpZip = ref<HTMLInputElement>(), inpDir = ref<HTMLInputElement>();
const API = import.meta.env.VITE_API_URL || "/api";
const auth = (): Record<string, string> => { const t = localStorage.getItem("zadm_token"); return t ? { authorization: "Bearer " + t } : {}; };

// папка: относительные пути файлов, корень — папка с index.html наименьшей вложенности
const rel = (f: File) => (f as any).webkitRelativePath || f.name;
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
  busy.value = true;
  try {
    const m = await api<{ id: string }>("/tours/start", { method: "POST", body: JSON.stringify({ entityId: props.parentId, title: title.value.trim() || "3D-тур" }) });
    let done = 0, bytes = 0, failed: string[] = [];
    const queue = [...p.files];
    const worker = async () => {
      while (queue.length) {
        const f = queue.shift()!; const path = rel(f).slice(p.root.length);
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const fd = new FormData(); fd.append("path", path); fd.append("file", f, f.name);
            const r = await fetch(`${API}/tours/${m.id}/file`, { method: "POST", headers: auth(), body: fd });
            if (!r.ok) throw new Error("HTTP " + r.status);
            break;
          } catch (e) { if (attempt === 2) failed.push(path); else await new Promise((r) => setTimeout(r, 1000 * (attempt + 1))); }
        }
        done++; bytes += f.size;
        progress.value = `Загружено ${done} из ${p.files.length} файлов · ${fmtSize(bytes)} из ${fmtSize(p.size)}${failed.length ? ` · ошибок: ${failed.length}` : ""}`;
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    if (failed.length) { toast(`Не загрузились ${failed.length} файлов — повторите загрузку`); busy.value = false; return; }
    await api(`/tours/${m.id}/finish`, { method: "POST", body: JSON.stringify({ index: p.index, files: p.files.length, size: p.size }) });
    await load(); toast("3D-тур загружен и добавлен в галерею"); emit("close");
  } catch (e: any) { toast("Ошибка: " + e.message); }
  busy.value = false;
}
function uploadZip() {
  if (!file.value) return;
  busy.value = true; progress.value = "Загружаем архив…";
  const fd = new FormData(); fd.append("file", file.value); fd.append("entityId", props.parentId); if (title.value.trim()) fd.append("title", title.value.trim());
  const xhr = new XMLHttpRequest();
  xhr.open("POST", API + "/tours");
  const h = auth(); if (h.authorization) xhr.setRequestHeader("authorization", h.authorization);
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
  <Modal title="3D-тур" @close="!busy && emit('close')">
    <div class="chips" style="margin-top:8px">
      <span class="fchip" :class="{ on: mode === 'dir' }" @click="!busy && (mode = 'dir')">Папка тура</span>
      <span class="fchip" :class="{ on: mode === 'zip' }" @click="!busy && (mode = 'zip')">ZIP до 2 ГБ</span>
      <span class="fchip" :class="{ on: mode === 'link' }" @click="!busy && (mode = 'link')">Ссылка или код эмбеда</span>
    </div>
    <div class="field"><label>Название</label><input class="inp" v-model="title" placeholder="3D-тур по выставке" :disabled="busy"></div>
    <template v-if="mode === 'dir'">
      <div class="field"><label>Распакованная папка тура от студии (с index.html внутри)</label>
        <input type="file" ref="inpDir" webkitdirectory directory multiple style="display:none" @change="pickDir">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <button class="btn sm" :disabled="busy" @click="inpDir?.click()">Выбрать папку</button>
          <span v-if="plan" style="font-size:13px">{{ plan.files.length }} файлов · {{ fmtSize(plan.size) }} · старт: {{ plan.index }}</span>
          <span v-else-if="dirFiles.length" style="font-size:13px;color:#9a2e2e">В папке нет index.html</span>
        </div>
        <div class="muted" style="font-size:12px;margin-top:6px">Файлы уходят в хранилище архива по одному, можно гигабайтами — тур будет жить у нас, без сторонних сервисов. Не закрывайте вкладку до конца загрузки.</div></div>
      <div v-if="progress" class="admbar" style="margin:0 0 8px">{{ progress }}</div>
      <div class="right"><button class="btn" :disabled="busy" @click="emit('close')">Отмена</button><button class="btn dark" :disabled="busy || !plan" @click="uploadDir">Загрузить</button></div>
    </template>
    <template v-else-if="mode === 'zip'">
      <div class="field"><label>Архив (ZIP с index.html внутри)</label>
        <input type="file" ref="inpZip" accept=".zip,application/zip" style="display:none" @change="file = ($event.target as HTMLInputElement).files?.[0] || null">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button class="btn sm" :disabled="busy" @click="inpZip?.click()">Выбрать файл</button><span v-if="file" style="font-size:13px">{{ file.name }} · {{ fmtSize(file.size) }}</span></div>
        <div class="muted" style="font-size:12px;margin-top:6px">Для архивов больше 2 ГБ используйте «Папка тура».</div></div>
      <div v-if="progress" class="admbar" style="margin:0 0 8px">{{ progress }}</div>
      <div class="right"><button class="btn" :disabled="busy" @click="emit('close')">Отмена</button><button class="btn dark" :disabled="busy || !file || file.size > 2 * 1024 ** 3" @click="uploadZip">Загрузить</button></div>
    </template>
    <template v-else>
      <div class="field"><label>Код эмбеда или ссылка</label><textarea class="inp" v-model="code" style="font-family:monospace;font-size:12px" placeholder='<iframe src="https://my.matterport.com/show/?m=…" …></iframe>'></textarea>
        <div class="muted" style="font-size:12px;margin-top:4px">Matterport, Kuula, 3DVista и т.п. Берём из кода только адрес.</div></div>
      <div class="right"><button class="btn" @click="emit('close')">Отмена</button><button class="btn dark" :disabled="busy" @click="saveLink">Добавить</button></div>
    </template>
  </Modal>
</template>
