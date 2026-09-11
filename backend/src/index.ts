import { createApp } from "./app.js";
import { db } from "./db.js";

// автосид: пустая база наполняется данными прототипа при первом старте
const count = (db.prepare("SELECT count(*) c FROM entities").get() as any).c;
if (!count) {
  console.log("База пуста — выполняю сид из данных прототипа…");
  await import("./seed.js");
}

const port = Number(process.env.PORT || 3000);
createApp().listen(port, () => {
  console.log(`Zotov Archive API · http://localhost:${port}/api/health`);
});
