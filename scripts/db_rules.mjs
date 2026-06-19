/**
 * Правила валидации steels_base.json — единый источник для теста (tests/data.test.ts)
 * и CLI-валидатора (scripts/validate_db.mjs).
 *
 * validateDb(db) → массив строк-проблем (пустой = БД валидна).
 */

/** Базовые элементы — обязаны присутствовать у каждой марки (ключ есть всегда). */
export const BASE_ELEMENTS = ["C", "Cr", "Mo", "V", "Mn", "Si", "Ni", "P", "S", "Cu"];

/** Все допустимые элементы химсостава (база + опциональные). */
export const ALL_ELEMENTS = [
    ...BASE_ELEMENTS, "Ti", "W", "Co", "Al", "As", "B", "N",
];

/** Допустимые классы стали (синхронно с типом SteelCategory). */
export const CATEGORIES = [
    "конструкционная углеродистая",
    "конструкционная легированная",
    "рессорно-пружинная",
    "подшипниковая",
    "инструментальная углеродистая",
    "инструментальная легированная",
    "быстрорежущая",
    "коррозионностойкая",
];

const isNum = (x) => typeof x === "number" && Number.isFinite(x);
const isNullOrNum = (x) => x === null || isNum(x);

/** Проверка диапазона MinMax: типы, 0≤значения≤hi, min≤max. */
function checkRange(issues, where, mm, hi) {
    if (mm === null || typeof mm !== "object") {
        issues.push(`${where}: не объект {min,max}`);
        return;
    }
    if (!isNullOrNum(mm.min) || !isNullOrNum(mm.max)) {
        issues.push(`${where}: min/max должны быть числом или null`);
        return;
    }
    for (const k of ["min", "max"]) {
        const v = mm[k];
        if (v !== null && (v < 0 || v > hi)) issues.push(`${where}.${k}=${v} вне [0, ${hi}]`);
    }
    if (mm.min !== null && mm.max !== null && mm.min > mm.max)
        issues.push(`${where}: min(${mm.min}) > max(${mm.max})`);
}

function checkScalar(issues, where, v, hi) {
    if (!isNullOrNum(v)) {
        issues.push(`${where}: должно быть числом или null`);
        return;
    }
    if (v !== null && (v < 0 || v > hi)) issues.push(`${where}=${v} вне [0, ${hi}]`);
}

export function validateDb(db) {
    const issues = [];
    if (!db || !Array.isArray(db.steels)) {
        return ["корень: нет массива steels"];
    }

    const ids = new Set();
    const names = new Set();

    for (const s of db.steels) {
        const where = s?.name || s?.id || "?";

        // --- обязательные поля ---
        if (!s.id) issues.push(`${where}: нет id`);
        if (!s.name) issues.push(`${where}: нет name`);
        if (typeof s.description !== "string" || !s.description.trim())
            issues.push(`${where}: пустое description`);
        if (!CATEGORIES.includes(s.category))
            issues.push(`${where}: недопустимая категория "${s.category}"`);

        // --- уникальность ---
        if (s.id) {
            if (ids.has(s.id)) issues.push(`дубль id: ${s.id}`);
            ids.add(s.id);
        }
        if (s.name) {
            if (names.has(s.name)) issues.push(`дубль name: ${s.name}`);
            names.add(s.name);
        }

        // --- стандарты ---
        const st = s.standards;
        if (!st || typeof st !== "object") {
            issues.push(`${where}: нет standards`);
        } else {
            if (!st.gost || typeof st.gost !== "string")
                issues.push(`${where}: standards.gost обязателен`);
            for (const k of ["aisi", "din_en", "jis"]) {
                if (!(st[k] === null || typeof st[k] === "string"))
                    issues.push(`${where}: standards.${k} должен быть string|null`);
            }
        }

        // --- химический состав ---
        const chem = s.chemical_composition;
        if (!chem || typeof chem !== "object") {
            issues.push(`${where}: нет chemical_composition`);
        } else {
            for (const el of BASE_ELEMENTS)
                if (!(el in chem)) issues.push(`${where}: нет базового элемента ${el}`);
            for (const [el, mm] of Object.entries(chem)) {
                if (!ALL_ELEMENTS.includes(el)) {
                    issues.push(`${where}: неизвестный элемент ${el}`);
                    continue;
                }
                checkRange(issues, `${where}.${el}`, mm, 100);
            }
        }

        // --- механические свойства ---
        const mp = s.mechanical_properties;
        if (!mp || typeof mp !== "object") {
            issues.push(`${where}: нет mechanical_properties`);
        } else {
            checkRange(issues, `${where}.hardness_hrc`, mp.hardness_hrc, 70);
            checkRange(issues, `${where}.hardness_hb`, mp.hardness_hb, 1000);
            checkScalar(issues, `${where}.tensile_strength_mpa`, mp.tensile_strength_mpa, 5000);
            checkScalar(issues, `${where}.yield_strength_mpa`, mp.yield_strength_mpa, 5000);
            checkScalar(issues, `${where}.elongation_percent`, mp.elongation_percent, 100);
            checkScalar(issues, `${where}.impact_toughness_j_cm2`, mp.impact_toughness_j_cm2, 1000);
            // σт ≤ σв, если заданы оба.
            if (isNum(mp.yield_strength_mpa) && isNum(mp.tensile_strength_mpa) &&
                mp.yield_strength_mpa > mp.tensile_strength_mpa)
                issues.push(`${where}: σт(${mp.yield_strength_mpa}) > σв(${mp.tensile_strength_mpa})`);
        }

        // --- физические свойства ---
        const pp = s.physical_properties;
        if (!pp || typeof pp !== "object") {
            issues.push(`${where}: нет physical_properties`);
        } else {
            checkScalar(issues, `${where}.density_g_cm3`, pp.density_g_cm3, 25);
            checkScalar(issues, `${where}.thermal_conductivity_w_mk`, pp.thermal_conductivity_w_mk, 500);
        }
    }

    return issues;
}
