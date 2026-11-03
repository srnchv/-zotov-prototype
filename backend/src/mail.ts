// Отправка писем: провайдер выбирается переменными окружения, без них письма не уходят (сообщения всё равно сохраняются в базе).
//   MAIL_PROVIDER=resend  + RESEND_API_KEY, MAIL_FROM ("Архив Зотова <noreply@archive.centrezotov.ru>")
//   MAIL_PROVIDER=smtp    + SMTP_HOST, SMTP_PORT (465/587), SMTP_USER, SMTP_PASS, MAIL_FROM
// Получатель — «Почта для сообщений» в текстах сайта (админка) или REPORT_EMAIL.
import nodemailer from "nodemailer";

export const mailConfigured = () => (process.env.MAIL_PROVIDER === "resend" && !!process.env.RESEND_API_KEY) || (process.env.MAIL_PROVIDER === "smtp" && !!process.env.SMTP_HOST);
const FROM = () => process.env.MAIL_FROM || "noreply@archive.centrezotov.ru";

export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  if (!to || !mailConfigured()) return false;
  if (process.env.MAIL_PROVIDER === "resend") {
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: "Bearer " + process.env.RESEND_API_KEY, "content-type": "application/json" }, body: JSON.stringify({ from: FROM(), to: [to], subject, text }) });
    if (!r.ok) throw new Error("resend: " + r.status + " " + (await r.text()).slice(0, 200));
    return true;
  }
  const port = Number(process.env.SMTP_PORT || 465);
  const t = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" } : undefined });
  await t.sendMail({ from: FROM(), to, subject, text });
  return true;
}
