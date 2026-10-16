<script setup lang="ts">
import { onMounted, computed } from "vue";
import { S, all, loadAudit } from "../lib/store";
import { TYPES, CONTENT_TYPES, ACTL, fmtAt } from "../lib/model";
onMounted(() => loadAudit());
const counts = computed(() => CONTENT_TYPES.map((t) => [t, TYPES[t].pl, all(t).length] as const));
const recent = computed(() => (S.audit?.recent || []).slice(0, 8));
</script>
<template>
  <h1>Дашборд</h1>
  <div class="grid g4" style="margin-top:16px">
    <router-link v-for="[t, l, n] in counts" :key="t" class="card click" :to="{ path: '/entities', query: { type: t } }" style="padding:16px">
      <div style="font-size:28px;font-weight:600">{{ n }}</div><div class="muted" style="font-size:13px">{{ l }} →</div>
    </router-link>
  </div>
  <div class="card" style="margin-top:24px;max-width:760px"><b>Последние изменения</b>
    <div v-if="!S.audit" class="muted" style="font-size:13px;padding:8px 0">Загружаем журнал…</div>
    <div v-else-if="!recent.length" class="muted" style="font-size:13px;padding:8px 0">Изменений пока не было.</div>
    <div v-else>
      <div v-for="(a, i) in recent" :key="i" style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid var(--line);font-size:13px">
        <span><router-link class="lnk" :to="'/edit/' + a.entity_id">{{ a.entity_title || a.entity_id }}</router-link><br><span class="muted" style="font-size:11px">{{ ACTL[a.action] || a.action }} · {{ a.actor }}</span></span>
        <span class="muted" style="font-size:11px;white-space:nowrap">{{ fmtAt(a.at) }}</span>
      </div>
    </div>
  </div>
</template>
