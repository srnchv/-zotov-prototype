<script setup lang="ts">
// Редактор описания (ТЗ «Единый шаблон»): заголовок, абзац, список с буллитами, нумерованный список, сноска.
// Текст хранится как HTML (modelValue); сноски — маркер [n] в тексте (<span class="fn" data-fn="n">) + список текстов notes.
// Старые описания без разметки превращаются в абзацы при открытии. Нумерация сносок пересчитывается по порядку в тексте.
import { watch, onBeforeUnmount } from "vue";
import { useEditor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import { Node, mergeAttributes } from "@tiptap/core";

const props = defineProps<{ modelValue: string; notes: string[]; disabled?: boolean }>();
const emit = defineEmits<{ "update:modelValue": [v: string]; "update:notes": [v: string[]] }>();

// инлайн-узел сноски: атом, не редактируется, хранит номер
const Footnote = Node.create({
  name: "footnote", group: "inline", inline: true, atom: true, selectable: true,
  addAttributes() { return { n: { default: 1, parseHTML: (el) => Number((el as HTMLElement).dataset.fn || 1), renderHTML: (a) => ({ "data-fn": a.n }) } }; },
  parseHTML() { return [{ tag: "span.fn" }]; },
  renderHTML({ HTMLAttributes }) { return ["span", mergeAttributes({ class: "fn" }, HTMLAttributes), `[${HTMLAttributes["data-fn"]}]`]; },
});

const toHtml = (v: string) => { const s = String(v || "").trim(); if (!s) return ""; if (/^<([a-z][a-z0-9]*)[\s>]/i.test(s)) return s; return s.split(/\n\s*\n/).map((p) => "<p>" + p.replace(/\n/g, "<br>").replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</p>").join(""); };

const editor = useEditor({
  content: toHtml(props.modelValue),
  editable: !props.disabled,
  extensions: [StarterKit.configure({ heading: { levels: [2] }, code: false, codeBlock: false, blockquote: false, horizontalRule: false, strike: false }), Footnote],
  onUpdate: ({ editor }) => { emit("update:modelValue", editor.isEmpty ? "" : editor.getHTML()); renumber(); },
});
// при смене карточки — новый текст
watch(() => props.modelValue, (v) => { const e = editor.value; if (!e) return; const cur = e.getHTML(); if (toHtml(v) !== cur && (v || "") !== cur) e.commands.setContent(toHtml(v), { emitUpdate: false }); });
watch(() => props.disabled, (d) => editor.value?.setEditable(!d));
onBeforeUnmount(() => editor.value?.destroy());

// номера сносок — по порядку появления в тексте; тексты сносок переставляются вслед за ними
function renumber() {
  const e = editor.value; if (!e) return;
  const order: number[] = [];
  e.state.doc.descendants((node) => { if (node.type.name === "footnote") order.push(Number(node.attrs.n)); });
  const notes = props.notes || [];
  const newNotes = order.map((n) => notes[n - 1] || "");
  let changed = false;
  const tr = e.state.tr;
  let i = 0;
  e.state.doc.descendants((node, pos) => { if (node.type.name === "footnote") { i++; if (Number(node.attrs.n) !== i) { tr.setNodeMarkup(pos, undefined, { n: i }); changed = true; } } });
  if (changed) e.view.dispatch(tr);
  if (JSON.stringify(newNotes) !== JSON.stringify(notes)) emit("update:notes", newNotes);
  if (changed) emit("update:modelValue", e.getHTML());
}
function addNote() {
  const e = editor.value; if (!e) return;
  const n = (props.notes || []).length + 1;
  emit("update:notes", [...(props.notes || []), ""]);
  e.chain().focus().insertContent({ type: "footnote", attrs: { n } }).run();
  setTimeout(renumber, 0);
}
function setNote(i: number, v: string) { const arr = [...(props.notes || [])]; arr[i] = v; emit("update:notes", arr); }
const is = (name: string, attrs?: Record<string, unknown>) => editor.value?.isActive(name, attrs);
</script>
<template>
  <div class="rt" :class="{ off: disabled }">
    <div class="rt-bar" v-if="editor && !disabled">
      <button type="button" :class="{ on: is('paragraph') && !is('bulletList') && !is('orderedList') }" title="Абзац" @click="editor.chain().focus().setParagraph().run()">Абзац</button>
      <button type="button" :class="{ on: is('heading', { level: 2 }) }" title="Заголовок внутри описания" @click="editor.chain().focus().toggleHeading({ level: 2 }).run()">Заголовок</button>
      <button type="button" :class="{ on: is('bulletList') }" title="Список с буллитами" @click="editor.chain().focus().toggleBulletList().run()">• Список</button>
      <button type="button" :class="{ on: is('orderedList') }" title="Нумерованный список" @click="editor.chain().focus().toggleOrderedList().run()">1. Список</button>
      <span class="sep"></span>
      <button type="button" :class="{ on: is('bold') }" title="Полужирный" @click="editor.chain().focus().toggleBold().run()"><b>Ж</b></button>
      <button type="button" :class="{ on: is('italic') }" title="Курсив" @click="editor.chain().focus().toggleItalic().run()"><i>К</i></button>
      <span class="sep"></span>
      <button type="button" title="Вставить сноску в месте курсора" @click="addNote">[n] Сноска</button>
    </div>
    <EditorContent :editor="editor" class="rt-body" />
    <div v-if="(notes || []).length" class="rt-notes">
      <div class="kicker">Сноски <span class="muted" style="font-weight:400;letter-spacing:0;text-transform:none">— номер стоит в тексте, удалить сноску = удалить маркер [n] из текста</span></div>
      <div v-for="(t, i) in notes" :key="i" class="rt-note"><span class="n">[{{ i + 1 }}]</span><input class="inp" :value="t" :disabled="disabled" placeholder="Текст сноски" @input="setNote(i, ($event.target as HTMLInputElement).value)"></div>
    </div>
  </div>
</template>
<style>
.rt{border:1px solid var(--line,#ddd);background:#fff}
.rt.off{opacity:.7}
.rt-bar{display:flex;gap:4px;flex-wrap:wrap;padding:6px;border-bottom:1px solid var(--line,#ddd);background:#fafafa}
.rt-bar button{font:inherit;font-size:12px;padding:4px 8px;border:1px solid #ccc;background:#fff;cursor:pointer;border-radius:0}
.rt-bar button.on{background:#262626;color:#fff;border-color:#262626}
.rt-bar .sep{width:1px;background:#ddd;margin:0 4px}
.rt-body .tiptap{min-height:180px;padding:10px 12px;font-size:14px;line-height:1.5;outline:none}
.rt-body .tiptap p{margin:0 0 10px}
.rt-body .tiptap h2{font-size:16px;margin:14px 0 8px}
.rt-body .tiptap ul,.rt-body .tiptap ol{margin:0 0 10px;padding-left:28px}
.rt-body .tiptap .fn{display:inline-block;padding:0 3px;background:#efe7c8;font-size:12px;vertical-align:baseline;cursor:default}
.rt-body .tiptap .fn.ProseMirror-selectednode{outline:2px solid #262626}
.rt-notes{padding:8px 12px 10px;border-top:1px solid var(--line,#ddd)}
.rt-note{display:flex;gap:8px;align-items:center;margin-top:6px}
.rt-note .n{width:32px;font-size:12px;color:#8c8c8c;flex:none}
.rt-note .inp{font-size:13px;padding:5px 8px}
</style>
