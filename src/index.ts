/**
 * =========================
 * ENTRY POINT
 * =========================
 * Реэкспорт публичного API библиотеки.
 *   types        — типы данных для внешнего использования
 *   db           — доступ к БД марок (steels, getSteel, getSteelById)
 *   similarity   — сравнение и поиск похожих марок
 *   explain      — текстовое объяснение похожести двух марок
 */
export * from "./types.js";
export * from "./db.js";
export * from "./similarity.js";
export * from "./explain.js";
