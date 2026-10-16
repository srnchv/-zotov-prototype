<script setup lang="ts">
defineProps<{ title: string; wide?: boolean }>();
const emit = defineEmits<{ close: [] }>();
</script>
<template>
  <div class="ov" @click.self="emit('close')">
    <div class="modal" :class="{ wide }">
      <div class="mhead"><h2>{{ title }}</h2><button class="mclose" @click="emit('close')" aria-label="Закрыть">✕</button></div>
      <slot />
    </div>
  </div>
</template>
