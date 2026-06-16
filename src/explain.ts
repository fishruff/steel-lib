/**
 * =========================
 * SIMILARITY EXPLANATION
 * =========================
 * Человекочитаемое объяснение, чем две марки похожи и чем отличаются.
 * Без него инженер не доверится «чёрному ящику» similarity-метрики:
 * explainSimilarity показывает по каждому фактору конкретную дельту
 * («Углерод +0.22%», «Cr идентичен», «Твёрдость +30 HB»).
 *
 * Возвращает структуру { summary, factors } — и готовый текст, и сырые
 * числа (a/b/delta), чтобы потребитель мог отрисовать свой UI.
 */
import type { ChemicalComposition, MinMax, Steel } from "./types.js";
import { getSteel } from "./db.js";
import { calculateSimilarity } from "./similarity.js";

/** Язык генерируемых фраз. Числовые поля (a/b/delta) от языка не зависят. */
export type ExplainLang = "ru" | "en";

export type ExplainOptions = {
    lang?: ExplainLang;
};

/**
 * Один фактор сравнения (химический элемент или механическое свойство).
 *   key   — символ элемента ('C', 'Cr') или код свойства ('HB', 'HRC', 'σт', 'σв')
 *   a / b — характерное значение у первой / второй марки (центр диапазона)
 *   delta — b - a в тех же единицах (положительное → у b больше)
 *   text  — готовая человекочитаемая фраза на выбранном языке
 */
export type ExplainFactor = {
    key: string;
    a: number | null;
    b: number | null;
    delta: number | null;
    text: string;
};

export type ExplainResult = {
    summary: string;
    factors: ExplainFactor[];
};

/**
 * Характерное число из диапазона: центр для двусторонних,
 * сама граница для односторонних ("Max X" / "≥ X"), null если данных нет.
 */
const midValue = (mm: MinMax | undefined): number | null => {
    if (!mm) return null;
    if (mm.min !== null && mm.max !== null) return (mm.min + mm.max) / 2;
    if (mm.max !== null) return mm.max;
    if (mm.min !== null) return mm.min;
    return null;
};

const round = (n: number, digits: number): number => {
    const p = 10 ** digits;
    return Math.round(n * p) / p;
};

/** Подписи элементов; для отсутствующих в карте используется сам символ. */
const ELEMENT_NAMES: Record<string, { ru: string; en: string }> = {
    C:  { ru: "Углерод",  en: "Carbon" },
    Cr: { ru: "Хром",     en: "Chromium" },
    Ni: { ru: "Никель",   en: "Nickel" },
    Mo: { ru: "Молибден", en: "Molybdenum" },
    W:  { ru: "Вольфрам", en: "Tungsten" },
    V:  { ru: "Ванадий",  en: "Vanadium" },
    Mn: { ru: "Марганец", en: "Manganese" },
    Si: { ru: "Кремний",  en: "Silicon" },
    Ti: { ru: "Титан",    en: "Titanium" },
    Co: { ru: "Кобальт",  en: "Cobalt" },
};

/** Порядок вывода элементов — по убыванию значимости (главные классификаторы выше). */
const ELEMENT_ORDER = [
    "C", "Cr", "Ni", "Mo", "W", "V", "Mn", "Si", "Ti", "Co", "Al", "Cu", "P", "S", "As",
] as const;

/** Механические свойства: как достать значение, подпись, единица и порог «идентичности». */
const MECH_SPECS: {
    key: string;
    get: (s: Steel) => number | null;
    label: { ru: string; en: string };
    unit: { ru: string; en: string };
    eps: number;
}[] = [
    {
        key: "HRC",
        get: (s) => midValue(s.mechanical_properties.hardness_hrc),
        label: { ru: "Твёрдость", en: "Hardness" },
        unit: { ru: "HRC", en: "HRC" },
        eps: 1,
    },
    {
        key: "HB",
        get: (s) => midValue(s.mechanical_properties.hardness_hb),
        label: { ru: "Твёрдость", en: "Hardness" },
        unit: { ru: "HB", en: "HB" },
        eps: 5,
    },
    {
        key: "σт",
        get: (s) => s.mechanical_properties.yield_strength_mpa,
        label: { ru: "Предел текучести", en: "Yield strength" },
        unit: { ru: "МПа", en: "MPa" },
        eps: 10,
    },
    {
        key: "σв",
        get: (s) => s.mechanical_properties.tensile_strength_mpa,
        label: { ru: "Предел прочности", en: "Tensile strength" },
        unit: { ru: "МПа", en: "MPa" },
        eps: 10,
    },
];

const signed = (n: number): string => (n > 0 ? `+${n}` : `${n}`);

/** Фраза для химического элемента: «Углерод +0.22%» / «Cr идентичен». */
const chemFactor = (sym: string, a: number, b: number, lang: ExplainLang): ExplainFactor => {
    const label = ELEMENT_NAMES[sym]?.[lang] ?? sym;
    const delta = round(b - a, 3);
    const text =
        Math.abs(delta) < 0.005
            ? lang === "ru"
                ? `${label} идентичен`
                : `${label} identical`
            : `${label} ${signed(delta)}%`;
    return { key: sym, a, b, delta, text };
};

/** Фраза для механического свойства: «Твёрдость +30 HB» / «σт идентичен (МПа)». */
const mechFactor = (
    spec: (typeof MECH_SPECS)[number],
    a: number,
    b: number,
    lang: ExplainLang,
): ExplainFactor => {
    const label = spec.label[lang];
    const unit = spec.unit[lang];
    const delta = round(b - a, 0);
    const text =
        Math.abs(delta) < spec.eps
            ? lang === "ru"
                ? `${label} идентична (${unit})`
                : `${label} identical (${unit})`
            : `${label} ${signed(delta)} ${unit}`;
    return { key: spec.key, a, b, delta, text };
};

/**
 * Объяснить похожесть двух марок по именам.
 * Возвращает null, если хотя бы одна марка не найдена.
 *
 * @example
 *   explainSimilarity("Сталь 20", "Сталь 45");
 *   explainSimilarity("Сталь 20", "Сталь 45", { lang: "en" });
 */
export const explainSimilarity = (
    aName: string,
    bName: string,
    options: ExplainOptions = {},
): ExplainResult | null => {
    const a = getSteel(aName);
    const b = getSteel(bName);
    if (!a || !b) return null;

    const lang = options.lang ?? "ru";
    const { similarity } = calculateSimilarity(a, b);
    const pct = Math.round(similarity * 100);
    const summary = lang === "ru" ? `Похожи на ${pct}%` : `${pct}% similar`;

    const factors: ExplainFactor[] = [];

    // Химия — в порядке значимости; пропускаем элементы без данных у одной из
    // марок и следовые элементы, отсутствующие у обеих (шум).
    for (const sym of ELEMENT_ORDER) {
        const key = sym as keyof ChemicalComposition;
        const av = midValue(a.chemical_composition[key]);
        const bv = midValue(b.chemical_composition[key]);
        if (av === null || bv === null) continue;
        if (Math.abs(av) < 0.005 && Math.abs(bv) < 0.005) continue;
        factors.push(chemFactor(sym, av, bv, lang));
    }

    // Механика — только свойства, заданные у обеих марок.
    for (const spec of MECH_SPECS) {
        const av = spec.get(a);
        const bv = spec.get(b);
        if (av === null || bv === null) continue;
        factors.push(mechFactor(spec, av, bv, lang));
    }

    return { summary, factors };
};
