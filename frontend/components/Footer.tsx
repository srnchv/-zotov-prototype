export default function Footer({ className = "" }: { className?: string }) {
  return (
    <div className={"foot " + className}>
      <img src="/assets/footer.png" alt="" />
      <div className="flinks">
        <a href="#">Политика конфиденциальности</a>
        <a href="#">Обработка персональных данных</a>
        <a href="#">Публичная оферта</a>
        <a href="#" className="cop">© Центр Зотов, 2022–2026</a>
      </div>
    </div>
  );
}
