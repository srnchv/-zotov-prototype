<script setup lang="ts">
import { DLG, dlgDone } from "../lib/dialog";
import Modal from "./Modal.vue";
</script>
<template>
  <Modal v-if="DLG.open" :title="DLG.title" @close="dlgDone(false)">
    <div v-if="DLG.text" style="font-size:14px;white-space:pre-line;margin:4px 0 14px;max-width:520px">{{ DLG.text }}</div>
    <div v-if="DLG.input" class="field"><input class="inp" v-model="DLG.input.value" :placeholder="DLG.input.placeholder" autofocus @keydown.enter="dlgDone(true)"></div>
    <div class="right" style="margin-top:12px"><button class="btn" @click="dlgDone(false)">{{ DLG.cancel }}</button><button class="btn dark" :style="DLG.danger ? 'background:#9a2e2e;border-color:#9a2e2e' : ''" @click="dlgDone(true)">{{ DLG.ok }}</button></div>
  </Modal>
</template>
