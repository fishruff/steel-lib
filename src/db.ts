import rawData from "./steels_base.json";
import type { Steel, SteelDatabase } from "./types";

/**
 * =========================
 * DB LOADING
 * =========================
 * Подгружаем JSON-файл со всеми марками и кастуем к нашему типу.
 * Каст через `unknown` — TS не может вывести литеральные union-типы
 * (SteelCategory) из JSON-импорта автоматически.
 */
const db = rawData as unknown as SteelDatabase;

/**
 * Плоский массив всех марок — основной источник данных для запросов.
 */
export const steels: Steel[] = db.steels;

/**
 * =========================
 * LOOKUP
 * =========================
 */

/** Найти сталь по точному совпадению имени (например "Ст3", "40Х", "12Х18Н10Т"). */
export const getSteel = (name: string): Steel | undefined =>
    steels.find((s) => s.name === name);

/** Найти сталь по уникальному id (например "gost-st3", "gost-40x"). */
export const getSteelById = (id: string): Steel | undefined =>
    steels.find((s) => s.id === id);
