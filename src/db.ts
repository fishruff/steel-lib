import rawData from "./steels_base.json" with { type: "json" };
import type { Steel, SteelDatabase } from "./types.js";

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

/**
 * Внутренний хелпер: проверяет совпадение запроса с обозначением по
 * зарубежному стандарту. Учитывает варианты записи:
 *   - точное совпадение ("304" === "304")
 *   - первый токен ("5115" совпадает с "5115 (близкий)")
 *   - часть в скобках ("1.4541" совпадает с "X6CrNiTi18-10 (1.4541)")
 * Регистр игнорируется.
 */
const matchesStandard = (storedValue: string | null, query: string): boolean => {
    if (!storedValue) return false;
    const q = query.trim().toLowerCase();
    const v = storedValue.trim().toLowerCase();

    if (v === q) return true;

    const firstToken = v.split(/[\s(]/)[0];
    if (firstToken === q) return true;

    const parenMatch = v.match(/\(([^)]+)\)/);
    if (parenMatch && parenMatch[1].trim() === q) return true;

    return false;
};

/**
 * Найти сталь по обозначению зарубежного стандарта (AISI, DIN/EN, JIS).
 * Примеры: "304" → 08Х18Н10, "D2" → Х12МФ, "1.4541" → 12Х18Н10Т, "SUS321" → 08Х18Н10Т.
 * Возвращает первую найденную марку (если код встречается у нескольких — берётся первая в БД).
 */
export const getSteelByStandard = (name: string): Steel | undefined =>
    steels.find(
        (s) =>
            matchesStandard(s.standards.aisi, name) ||
            matchesStandard(s.standards.din_en, name) ||
            matchesStandard(s.standards.jis, name),
    );
