<script setup lang="ts">
// 3D-тур: либо ZIP-пакет от студии (index.html + ресурсы) — распаковывается в наше хранилище и живёт у нас,
// либо ссылка / код эмбеда внешнего сервиса (Matterport, Kuula…). На сайте в обоих случаях — свой iframe с полноэкранным режимом.
import { ref } from "vue";
import Modal from "./Modal.vue";
import { api, load, toast } from "../lib/store";
import { fmtSize } from "../lib/model";
const props = defineProps<{ parentId: string }>();
const emit = defineEmits<{ close: [] }>();
const mode = ref<"zip" | "link">("zip");
const title = ref(""), code = ref(""), file = ref<File | null>(null), busy = ref(false), progress = ref("");
const inp = ref<HTMLInputElement>();
async function saveLink() {
  const m = code.value.match(/src\s*=\s*["']([^"']+)["']/i);
  const src = (m ? m[1] : code.value).trim();
  if (!/^https:\/\//i.test(src)) { toast("Нужна ссылка вида https://… или код с iframe"); return; }
  busy.value = true;
  try {
    await api("/entities", { method: "POST", body: JSON.stringify({ type: "media", title: title.value.trim() || "3D-тур", payload: { kind: "tour", embed: src, parent: props.parentId }, links: [props.parentId] }) });
    await load(); toast("3D-тур добавлен в галерею"); emit("close");
  } catch (e: any) { toast("Ошибка: " + e.message); }
  busy.value = false;
}
function saveZip() {
  if (!file.value) return;
  busy.value = true; progress.value = "Загружаем архив…";
  const fd = new FormData(); fd.append("file", file.value); fd.append("entityId", props.parentId); if (title.value.trim()) fd.append("title", title.value.trim());
  // XHR — ради прогресса загрузки больших архивов
  const xhr = new XMLHttpRequest();
  xhr.open("POST", (import.meta.env.VITE_API_URL || "/api") + "/tours");
  const t = localStorage.getItem("zadm_token"); if (t) xhr.setRequestHeader("authorization", "Bearer " + t);
  xhr.upload.onprogress = (e) => { if (e.lengthComputable) progress.value = e.loaded >= e.total ? "Распаковываем в хранилище — это может занять пару минут…" : `Загружаем архив: ${Math.round((e.loaded / e.total) * 100)}%`; };
  xhr.onload = async () => {
    busy.value = false;
    if (xhr.status >= 200 && xhr.status < 300) { await load(); toast("3D-тур распакован и добавлен в галерею"); emit("close"); }
    else { let msg = "HTTP " + xhr.status; try { msg = JSON.parse(xhr.responseText).error || msg; } catch {} toast("Ошибка: " + msg); progress.value = ""; }
  };
  xhr.onerror = () => { busy.value = false; progress.value = ""; toast("Ошибка сети при загрузке"); };
  xhr.send(fd);
}
</script>
<template>
  <Modal title="3D-тур" @close="!busy && emit('close')">
    <div class="chips" style="margin-top:8px">
      <span class="fchip" :class="{ on: mode === 'zip' }" @click="mode = 'zip'">ZIP-пакет тура</span>
      <span class="fchip" :class="{ on: mode === 'link' }" @click="mode = 'link'">Ссылка или код эмбеда</span>
    </div>
    <div class="field"><label>Название</label><input class="inp" v-model="title" placeholder="3D-тур по выставке" :disabled="busy"></div>
    <template v-if="mode === 'zip'">
      <div class="field"><label>Архив от студии (ZIP с index.html внутри, до 2 ГБ)</label>
        <input type="file" ref="inp" accept=".zip,application/zip" style="display:none" @change="file = ($event.target as HTMLInputElement).files?.[0] || null">
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <button class="btn sm" :disabled="busy" @click="inp?.click()">Выбрать файл</button>
          <span v-if="file" style="font-size:13px">{{ file.name }} · {{ fmtSize(file.size) }}</span>
        </div>
        <div class="muted" style="font-size:12px;margin-top:6px">Архив распакуется в хранилище архива — тур будет жить у нас, без сторонних сервисов. Папку верхнего уровня внутри архива определим сами.</div></div>
      <div v-if="progress" class="admbar" style="margin:0 0 8px">{{ progress }}</div>
      <div class="right"><button class="btn" :disabled="busy" @click="emit('close')">Отмена</button><button class="btn dark" :disabled="busy || !file" @click="saveZip">Загрузить</button></div>
    </template>
    <template v-else>
      <div class="field"><label>Код эмбеда или ссылка</label><textarea class="inp" v-model="code" style="font-family:monospace;font-size:12px" placeholder='<iframe src="https://my.matterport.com/show/?m=…" …></iframe>'></textarea>
        <div class="muted" style="font-size:12px;margin-top:4px">Matterport, Kuula, 3DVista и т.п. Берём из кода только адрес.</div></div>
      <div class="right"><button class="btn" @click="emit('close')">Отмена</button><button class="btn dark" :disabled="busy" @click="saveLink">Добавить</button></div>
    </template>
  </Modal>
</template>
