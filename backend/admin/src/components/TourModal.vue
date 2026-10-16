<script setup lang="ts">
// 3D-тур: код эмбеда (iframe) или ссылка; храним только адрес — на сайте свой iframe с полноэкранным режимом
import { ref } from "vue";
import Modal from "./Modal.vue";
import { api, load, toast } from "../lib/store";
const props = defineProps<{ parentId: string }>();
const emit = defineEmits<{ close: [] }>();
const title = ref(""), code = ref("");
async function save() {
  const m = code.value.match(/src\s*=\s*["']([^"']+)["']/i);
  const src = (m ? m[1] : code.value).trim();
  if (!/^https:\/\//i.test(src)) { toast("Нужна ссылка вида https://… или код с iframe"); return; }
  try {
    await api("/entities", { method: "POST", body: JSON.stringify({ type: "media", title: title.value.trim() || "3D-тур", payload: { kind: "tour", embed: src, parent: props.parentId }, links: [props.parentId] }) });
    await load(); toast("3D-тур добавлен в галерею"); emit("close");
  } catch (e: any) { toast("Ошибка: " + e.message); }
}
</script>
<template>
  <Modal title="3D-тур" @close="emit('close')">
    <div class="field"><label>Название</label><input class="inp" v-model="title" placeholder="3D-тур по выставке"></div>
    <div class="field"><label>Код эмбеда или ссылка</label><textarea class="inp" v-model="code" style="font-family:monospace;font-size:12px" placeholder='<iframe src="https://my.matterport.com/show/?m=…" …></iframe>'></textarea>
      <div class="muted" style="font-size:12px;margin-top:4px">Matterport, Kuula, 3DVista и т.п. Берём из кода только адрес. На сайте тур откроется в окне галереи, на весь экран — кнопкой самого тура.</div></div>
    <div class="right"><button class="btn" @click="emit('close')">Отмена</button><button class="btn dark" @click="save">Добавить</button></div>
  </Modal>
</template>
