<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { login } from "../lib/store";
const l = ref(""), p = ref(""), err = ref(""), busy = ref(false);
const router = useRouter();
async function go() {
  err.value = ""; busy.value = true;
  try { await login(l.value.trim(), p.value); router.replace("/dash"); }
  catch (e: any) { err.value = e.message || "Не удалось войти"; }
  busy.value = false;
}
</script>
<template>
  <div class="login">
    <form class="card" @submit.prevent="go">
      <div class="kicker">Зотов · Архив</div>
      <h1 style="font-size:22px;margin-top:6px">Админ-панель</h1>
      <div class="field"><label>Логин</label><input class="inp" v-model="l" autocomplete="username" autofocus></div>
      <div class="field"><label>Пароль</label><input class="inp" type="password" v-model="p" autocomplete="current-password"></div>
      <div v-if="err" class="admbar err" style="margin:0 0 14px">{{ err }}</div>
      <button class="btn dark" type="submit" :disabled="busy || !l || !p" style="width:100%">{{ busy ? "Входим…" : "Войти" }}</button>
      <div class="muted" style="font-size:12px;margin-top:14px">Доступ выдаёт администратор архива. Забыли пароль — попросите его сбросить.</div>
    </form>
  </div>
</template>
