// Диалоги админки вместо системных confirm/prompt: своё окно в стиле админки, с нормальным заголовком.
// ask() — подтверждение (true/false), askInput() — ввод строки (null — отмена).
import { reactive } from "vue";
type Opts = { ok?: string; cancel?: string; danger?: boolean };
export const DLG = reactive({ open: false, title: "", text: "", ok: "Да", cancel: "Отмена", danger: false, input: null as null | { value: string; placeholder: string }, resolve: null as null | ((v: unknown) => void) });
function show(title: string, text: string, opts: Opts, input: null | { value: string; placeholder: string }) {
  return new Promise<unknown>((resolve) => {
    Object.assign(DLG, { open: true, title, text, ok: opts.ok || (input ? "Сохранить" : "Да"), cancel: opts.cancel || "Отмена", danger: !!opts.danger, input, resolve });
  });
}
export const ask = (title: string, text = "", opts: Opts = {}) => show(title, text, opts, null) as Promise<boolean>;
export const askInput = (title: string, text = "", value = "", placeholder = "", opts: Opts = {}) => show(title, text, opts, { value, placeholder }) as Promise<string | null>;
export function dlgDone(okPressed: boolean) {
  const r = DLG.resolve; const v = DLG.input ? (okPressed ? DLG.input.value : null) : okPressed;
  DLG.open = false; DLG.resolve = null; DLG.input = null;
  r?.(v);
}
