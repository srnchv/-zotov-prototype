<script setup lang="ts">
// Сообщения «Напишите нам, если нашли несоответствие» с публичных страниц. Хранятся всегда; письмом уходят, если настроена почта (env API).
import { ref, onMounted } from "vue";
import { api, toast, isAdmin, S } from "../lib/store";
import { ask } from "../lib/dialog";
import { fmtAt } from "../lib/model";
type Rep = { id: string; entity_id: string; title: string; url: string; text: string; at: string; read_at: string | null; sent: number };
const items = ref<Rep[]>([]), mail = ref(false), loading = ref(true);
async function load() { try { const r = await api("/reports"); items.value = r.items; mail.value = r.mail; S.unreadReports = r.unread; } catch (e: any) { toast("Ошибка: " + e.message); } loading.value = false; }
async function read(r: Rep) { if (r.read_at) return; await api("/reports/" + r.id + "/read", { method: "POST" }); r.read_at = new Date().toISOString(); S.unreadReports = Math.max(0, (S.unreadReports || 0) - 1); }
async function del(r: Rep) { if (!(await ask("Удалить сообщение", "Сообщение будет удалено без возможности восстановления.", { ok: "Удалить", danger: true }))) return; await api("/reports/" + r.id, { method: "DELETE" }); items.value = items.value.filter((x) => x.id !== r.id); }
onMounted(load);
</script>
<template>
  <h1>Сообщения с сайта</h1>
  <div class="muted" style="font-size:13px;margin-bottom:14px">Форма «Напишите нам, если нашли несоответствие» на страницах карточек. Клик по сообщению отмечает его прочитанным.
    <span v-if="mail"> Письма уходят на адрес из «Текстов сайта» → «Сообщения с сайта».</span><span v-else> Отправка писем не настроена — сообщения только здесь; подключение почты — переменными окружения API (MAIL_PROVIDER).</span></div>
  <div v-if="loading" class="muted">Загрузка…</div>
  <div v-else-if="!items.length" class="muted">Сообщений пока нет.</div>
  <div v-for="r in items" :key="r.id" class="rep" :class="{ unread: !r.read_at }" @click="read(r)">
    <div class="meta"><span>{{ fmtAt(r.at) }}</span><span v-if="r.title">Карточка: <router-link v-if="r.entity_id && S.db[r.entity_id]" :to="'/edit/' + r.entity_id" @click.stop>{{ r.title }}</router-link><template v-else>{{ r.title }}</template></span><a v-if="r.url" :href="r.url" target="_blank" rel="noreferrer" @click.stop>открыть на сайте</a><span v-if="r.sent">· письмо отправлено</span><span v-if="isAdmin" class="lnk" style="margin-left:auto;color:#9a2e2e" @click.stop="del(r)">удалить</span></div>
    <div class="txt">{{ r.text }}</div>
  </div>
</template>
