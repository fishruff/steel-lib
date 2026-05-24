/**
 * =========================
 * ENTRY POINT
 * =========================
 * Реэкспорт публичного API библиотеки.
 *   types        — типы данных для внешнего использования
 *   db           — доступ к БД марок (steels, getSteel, getSteelById)
 *   similarity   — сравнение и поиск похожих марок
 */
export * from "./types";
export * from "./db";
export * from "./similarity";

import { compareSteel } from "./similarity";

// Демонстрационный вызов — можно удалить.
console.log(compareSteel("Ст3", "50"));
