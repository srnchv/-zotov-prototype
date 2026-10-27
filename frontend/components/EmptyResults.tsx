// Пустая выдача — общий блок поиска, хронографа и карты: иллюстрация с «?», «ничего не найдено», подсказка
export default function EmptyResults({ text = "Попробуйте изменить запрос." }: { text?: string }) {
  return (
    <div id="empty">
      <img className="eimg" src="/assets/nothing-found.svg" alt="" aria-hidden="true" />
      <h2>ничего не найдено</h2>
      <p>{text}</p>
    </div>
  );
}
