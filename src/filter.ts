/**
 * =========================
 * SELECTION ENGINE
 * =========================
 * Подбор марок под ТЗ: findBy(criteria) возвращает все марки, удовлетворяющие
 * всем заданным условиям (семантика AND; пустой критерий — все марки).
 *
 * Интерпретация границ — «по гарантии стандарта»:
 *   min* (minCarbon, minTensile, minElement, ...) — проверяется гарантированная
 *        НИЖНЯЯ граница марки: марка проходит, только если её минимум ≥ порога.
 *   max* (maxCarbon, maxTensile, maxElement, ...) — проверяется гарантированная
 *        ВЕРХНЯЯ граница: марка проходит, только если её максимум ≤ порога.
 * Если у марки нет данных по нормируемому критерию — она не проходит этот
 * критерий (нельзя гарантировать → исключаем).
 */
import type { ChemicalComposition, MinMax, Steel, SteelCategory } from "./types.js";
import { steels } from "./db.js";

/** Символ химического элемента из композиции (C, Cr, Ni, Mo, ...). */
export type ElementSymbol = keyof ChemicalComposition;

/**
 * Критерий подбора. Все поля опциональны, объединяются по AND.
 * Поля-массивы (category, hasElement) трактуются как: «входит в список» /
 * «легирована всеми перечисленными».
 */
export type SteelFilter = {
    /** Класс стали; массив — любая из перечисленных категорий (OR). */
    category?: SteelCategory | SteelCategory[];

    /** Предел прочности σв, МПа. */
    minTensile?: number;
    maxTensile?: number;
    /** Предел текучести σт, МПа. */
    minYield?: number;
    maxYield?: number;
    /** Относительное удлинение, %. */
    minElongation?: number;
    maxElongation?: number;
    /** Твёрдость HRC. */
    minHardnessHrc?: number;
    maxHardnessHrc?: number;
    /** Твёрдость HB. */
    minHardnessHb?: number;
    maxHardnessHb?: number;

    /** Содержание углерода, %. */
    minCarbon?: number;
    maxCarbon?: number;

    /** Легирована указанным элементом (есть гарантированный минимум > 0). */
    hasElement?: ElementSymbol | ElementSymbol[];
    /** Нижний порог по содержанию элементов, %: { Cr: 0.8, Ni: 1 }. */
    minElement?: Partial<Record<ElementSymbol, number>>;
    /** Верхний порог по содержанию элементов, %: { S: 0.04, P: 0.035 }. */
    maxElement?: Partial<Record<ElementSymbol, number>>;
};

/** Скалярное свойство (одно число): проходит, если в [min, max]. null → не проходит при наличии порога. */
const scalarOk = (value: number | null, min?: number, max?: number): boolean => {
    if (min === undefined && max === undefined) return true;
    if (value === null) return false;
    if (min !== undefined && value < min) return false;
    if (max !== undefined && value > max) return false;
    return true;
};

/**
 * Диапазонное свойство (MinMax): min-порог проверяет нижнюю границу марки,
 * max-порог — верхнюю. Отсутствие нужной границы (null) при наличии порога → не проходит.
 */
const rangeOk = (mm: MinMax | undefined, min?: number, max?: number): boolean => {
    if (min === undefined && max === undefined) return true;
    if (!mm) return false;
    if (min !== undefined && (mm.min === null || mm.min < min)) return false;
    if (max !== undefined && (mm.max === null || mm.max > max)) return false;
    return true;
};

/** Марка реально легирована элементом: есть гарантированный минимум > 0 (а не остаточная примесь «Max X»). */
const isAlloyedWith = (s: Steel, sym: ElementSymbol): boolean => {
    const mm = s.chemical_composition[sym];
    return !!mm && mm.min !== null && mm.min > 0;
};

/** Проверить, удовлетворяет ли марка критерию (AND по всем заданным полям). */
export const matchesFilter = (s: Steel, f: SteelFilter): boolean => {
    if (f.category !== undefined) {
        const cats = Array.isArray(f.category) ? f.category : [f.category];
        if (!cats.includes(s.category)) return false;
    }

    const mp = s.mechanical_properties;
    if (!scalarOk(mp.tensile_strength_mpa, f.minTensile, f.maxTensile)) return false;
    if (!scalarOk(mp.yield_strength_mpa, f.minYield, f.maxYield)) return false;
    if (!scalarOk(mp.elongation_percent, f.minElongation, f.maxElongation)) return false;
    if (!rangeOk(mp.hardness_hrc, f.minHardnessHrc, f.maxHardnessHrc)) return false;
    if (!rangeOk(mp.hardness_hb, f.minHardnessHb, f.maxHardnessHb)) return false;

    if (!rangeOk(s.chemical_composition.C, f.minCarbon, f.maxCarbon)) return false;

    if (f.hasElement !== undefined) {
        const syms = Array.isArray(f.hasElement) ? f.hasElement : [f.hasElement];
        if (!syms.every((sym) => isAlloyedWith(s, sym))) return false;
    }

    if (f.minElement) {
        for (const [sym, min] of Object.entries(f.minElement)) {
            if (!rangeOk(s.chemical_composition[sym as ElementSymbol], min, undefined)) return false;
        }
    }
    if (f.maxElement) {
        for (const [sym, max] of Object.entries(f.maxElement)) {
            if (!rangeOk(s.chemical_composition[sym as ElementSymbol], undefined, max)) return false;
        }
    }

    return true;
};

/**
 * Подобрать марки под критерий. Возвращает массив полных Steel (в порядке БД).
 * Пустой критерий `{}` вернёт все марки.
 *
 * @example
 *   findBy({ category: "конструкционная углеродистая", maxCarbon: 0.25, minTensile: 400 });
 *   findBy({ hasElement: ["Cr", "Ni"], minHardnessHrc: 40 });
 */
export const findBy = (filter: SteelFilter = {}): Steel[] =>
    steels.filter((s) => matchesFilter(s, filter));
