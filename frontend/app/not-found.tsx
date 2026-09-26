import Sidebar from "@/components/Sidebar";
export default function NotFound() {
  return (<div style={{ padding: "120px 24px 24px 220px", fontSize: 20 }}>
    <Sidebar variant="mat" />
    <h1 style={{ fontSize: 50, lineHeight: "48px", textTransform: "uppercase", letterSpacing: -1.5 }}>Не найдено</h1>
    <p style={{ marginTop: 16 }}>Такого объекта в архиве нет или он ещё не опубликован. <a href="/" style={{ textDecoration: "underline" }}>На главную</a></p>
  </div>);
}
