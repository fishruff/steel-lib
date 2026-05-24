/**
 * =========================
 * ENTRY POINT
 * =========================
 * Реэкспорт публичного API библиотеки.
 *   types        — типы данных для внешнего использования
 *   db           — доступ к БД марок (steels, getSteel, getSteelById)
 *   similarity   — сравнение и поиск похожих марок
 */
export * from "./types.js";
export * from "./db.js";
export * from "./similarity.js";

import { compareSteel } from "./similarity.js";

// Демонстрационный вызов — можно удалить.
console.log(compareSteel("Ст3", "Сталь 50"));
