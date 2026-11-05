<script setup lang="ts">
// Дашборд по макету: леттеринг «дашборд», карточки сущностей в 3 колонки, справа панель «Последние изменения»
import { onMounted, computed } from "vue";
import { S, all, loadAudit } from "../lib/store";
import { TYPES, CONTENT_TYPES, ACTL, fmtAt, plural } from "../lib/model";
onMounted(() => loadAudit());
const WORDS: Record<string, [string, string, string]> = { material: ["материал", "материала", "материалов"], person: ["личность", "личности", "личностей"], place: ["место", "места", "мест"], event: ["событие", "события", "событий"], theme: ["тема", "темы", "тем"], project: ["проект", "проекта", "проектов"], org: ["организация", "организации", "организаций"], collection: ["коллекция", "коллекции", "коллекций"], source: ["текст", "текста", "текстов"] };
const counts = computed(() => CONTENT_TYPES.map((t) => { const n = all(t).length; return [t, TYPES[t].pl, `${n} ${plural(n, WORDS[t] || ["запись", "записи", "записей"])}`] as const; }));
const recent = computed(() => (S.audit?.recent || []).slice(0, 12));
</script>
<template>
  <div class="lt" aria-label="Дашборд"><span v-for="(ch, i) in 'дашборд'.split('')" :key="i">{{ ch }}</span></div>
  <div class="dash">
    <div class="cards">
      <router-link v-for="[t, l, n] in counts" :key="t" class="card click" :to="{ path: '/entities', query: { type: t } }">
        <div class="stat"><h2>{{ l }}</h2><div class="vb"></div><div class="n">{{ n }}</div></div>
      </router-link>
    </div>
    <div class="recent">
      <h3>Последние изменения</h3>
      <div v-if="!S.audit" class="muted">Загружаем журнал…</div>
      <div v-else-if="!recent.length" class="muted">Изменений пока не было.</div>
      <div v-else class="items">
        <router-link v-for="(a, i) in recent" :key="i" class="it" :to="'/edit/' + a.entity_id">
          <div class="t"><b>{{ a.entity_title || a.entity_id }}</b><span>{{ fmtAt(a.at) }}</span></div>
          <div>{{ ACTL[a.action] || a.action }} · {{ a.actor }}</div>
        </router-link>
        <div class="end"></div>
      </div>
    </div>
  </div>
</template>
