<script setup lang="ts">
// Пользователи админки (только администратор): логин, имя, роль, пароль, активность
import { ref, onMounted } from "vue";
import { S, api, toast } from "../lib/store";
import { ROLE_LABEL, fmtAt, type Role } from "../lib/model";
import Modal from "../components/Modal.vue";
type U = { id: string; login: string; name: string; role: Role; active: number; created_at?: string; last_login?: string | null };
const list = ref<U[]>([]), edit = ref<Partial<U> & { password?: string } | null>(null), busy = ref(false);
const reload = async () => { try { list.value = await api("/users"); } catch (e: any) { toast("Ошибка: " + e.message); } };
onMounted(reload);
async function save() {
  const u = edit.value!; busy.value = true;
  try {
    if (u.id) { const b: any = { login: u.login, name: u.name, role: u.role, active: !!u.active }; if (u.password) b.password = u.password; await api("/users/" + u.id, { method: "PATCH", body: JSON.stringify(b) }); }
    else await api("/users", { method: "POST", body: JSON.stringify({ login: u.login, name: u.name, role: u.role, password: u.password }) });
    edit.value = null; await reload(); toast("Сохранено");
  } catch (e: any) { toast("Ошибка: " + e.message); }
  busy.value = false;
}
async function del(u: U) { if (!confirm(`Удалить пользователя ${u.login}?`)) return; try { await api("/users/" + u.id, { method: "DELETE" }); await reload(); toast("Удалено"); } catch (e: any) { toast("Ошибка: " + e.message); } }
const ROLE_HINT: Record<Role, string> = { admin: "всё, включая пользователей и статистику", editor: "контент, медиа, справочники, главная", moderator: "просмотр и смена статуса публикации" };
</script>
<template>
  <div style="display:flex;justify-content:space-between;align-items:baseline;gap:16px"><h1>Пользователи</h1><button class="btn dark" @click="edit = { login: '', name: '', role: 'editor', active: 1, password: '' }">＋ Добавить</button></div>
  <div class="muted" style="font-size:14px;margin:6px 0 14px">Роли: <template v-for="(l, r) in ROLE_LABEL" :key="r"><b>{{ l }}</b> — {{ ROLE_HINT[r] }}; </template></div>
  <table class="atable"><thead><tr><th>Логин</th><th>Имя</th><th>Роль</th><th>Статус</th><th>Последний вход</th><th></th></tr></thead>
    <tbody><tr v-for="u in list" :key="u.id">
      <td style="font-weight:500">{{ u.login }}<span v-if="u.id === S.uid" class="muted"> (вы)</span></td><td>{{ u.name }}</td><td>{{ ROLE_LABEL[u.role] }}</td>
      <td><span class="statbadge" :class="{ draft: !u.active }">{{ u.active ? "активен" : "отключён" }}</span></td><td class="muted" style="font-size:12px">{{ fmtAt(u.last_login) || "—" }}</td>
      <td style="text-align:right;white-space:nowrap"><button class="btn sm" @click="edit = { ...u, password: '' }">Изменить</button> <button v-if="u.id !== S.uid" class="btn sm danger" @click="del(u)">Удалить</button></td>
    </tr></tbody></table>
  <Modal v-if="edit" :title="edit.id ? 'Пользователь' : 'Новый пользователь'" @close="edit = null">
    <div class="field"><label>Логин</label><input class="inp" v-model="edit.login" autocomplete="off"></div>
    <div class="field"><label>Имя (видно в журнале)</label><input class="inp" v-model="edit.name"></div>
    <div class="field"><label>Роль</label><select class="sel" v-model="edit.role"><option v-for="(l, r) in ROLE_LABEL" :key="r" :value="r">{{ l }} — {{ ROLE_HINT[r] }}</option></select></div>
    <div class="field"><label>{{ edit.id ? "Новый пароль (пусто — не менять)" : "Пароль (не короче 6 знаков)" }}</label><input class="inp" type="password" v-model="edit.password" autocomplete="new-password"></div>
    <label v-if="edit.id" class="check"><input type="checkbox" :checked="!!edit.active" @change="edit!.active = ($event.target as HTMLInputElement).checked ? 1 : 0"> Активен</label>
    <div class="right"><button class="btn" @click="edit = null">Отмена</button><button class="btn dark" :disabled="busy || !edit.login || (!edit.id && (edit.password || '').length < 6)" @click="save">Сохранить</button></div>
  </Modal>
</template>
