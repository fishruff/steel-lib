import type { ChemicalComposition, MinMax, Steel } from "./types";
import { getSteel, steels } from "./db";

/**
 * =========================
 * RANGE COMPARISON
 * =========================
 * Гибридная метрика похожести двух MinMax-диапазонов в [0..1]:
 *   1 — диапазоны идентичны
 *   0 — не пересекаются или нет данных
 *
 * Учитывает два компонента:
 *   overlapScore — доля пересечения от общего разброса (классическая IoU-метрика)
 *   centerScore  — близость центров (важно когда диапазоны узкие и смещены)
 * Веса 0.7/0.3 — пересечение важнее, центр корректирует.
 */
export const compareRange = (a: MinMax, b: MinMax): number => {
    // Оба диапазона "Max X" (только верхняя граница) — типично для примесных
    // элементов (Cr/Cu/P/S у углеродистых сталей). Сравниваем верхние границы.
    if (a.min === null && b.min === null && a.max !== null && b.max !== null) {
        const diff = Math.abs(a.max - b.max);
        const scale = Math.max(a.max, b.max) || 1;
        return 1 - Math.min(1, diff / scale);
    }

    // Оба диапазона "≥ X" (только нижняя граница) — редкий формат, но возможен.
    if (a.max === null && b.max === null && a.min !== null && b.min !== null) {
        const diff = Math.abs(a.min - b.min);
        const scale = Math.max(a.min, b.min) || 1;
        return 1 - Math.min(1, diff / scale);
    }

    // Разные формы (один с min, другой с max) или какой-то полностью пустой
    // — корректно сравнить нельзя.
    if (a.min === null || a.max === null || b.min === null || b.max === null) {
        return 0;
    }

    // Пересечение (отрицательное → диапазоны не пересекаются → 0).
    const overlap = Math.max(0, Math.min(a.max, b.max) - Math.max(a.min, b.min));

    // Полная ширина объединения двух диапазонов.
    const maxRange = Math.max(a.max, b.max) - Math.min(a.min, b.min);

    // Оба диапазона — одно и то же число → идеальное совпадение.
    if (maxRange === 0) return 1;

    const overlapScore = overlap / maxRange;

    const aCenter = (a.min + a.max) / 2;
    const bCenter = (b.min + b.max) / 2;
    const centerDiff = Math.abs(aCenter - bCenter);
    const centerScore = 1 - Math.min(1, centerDiff / maxRange);

    return overlapScore * 0.7 + centerScore * 0.3;
};

/**
 * =========================
 * WEIGHTS
 * =========================
 * Веса параметров для финальной similarity-метрики (сумма = 1).
 * Если какой-то параметр нельзя посчитать (например, yield = null),
 * его вес не входит в totalWeight и итог нормализуется корректно.
 */
export const WEIGHTS = {
    chemistry: 0.85, // вся химия через compareChem (взвешено по chemicalWeights)
    yield: 0.15, // механическая прочность (предел текучести)
};

/**
 * Веса для химического сравнения по всей композиции (см. compareChem).
 * Шкала [0..1]: 1 — главный классификатор марки, 0 — пренебрежимая примесь.
 *
 * Основания:
 *   - Главные классификаторы (C, Cr, Ni, Mo, W) определяют целые семейства
 *     сталей: углеродистые/легированные/нержавеющие/инструментальные/быстрорезы.
 *   - Промежуточная группа (V, Co, Mn, Si, Ti, Al) — существенно, но в рамках
 *     уже определённого класса.
 *   - Примеси (Cu, P, S, As) — нормируются стандартами как ограничения, но
 *     практически не меняют характер марки.
 *
 * Источники:
 *   - ASM Handbook Vol.1 — иерархия влияния легирующих элементов
 *   - IIW Carbon Equivalent (CEV = C + Mn/6 + (Cu+Ni)/15 + (Cr+Mo+V)/5)
 *     — относительный вклад в прокаливаемость/свариваемость
 *   - PREN = Cr + 3.3·Mo + 16·N — относительное влияние на коррозию
 */
/**
 * Дефолтный вес для элементов, отсутствующих в `chemicalWeights`.
 * Защищает от резкого скачка важности при добавлении нового элемента в БД:
 * новый элемент получит умеренный вес вместо максимального.
 */
const DEFAULT_WEIGHT = 0.3;

const chemicalWeights: Record<string, number> = {
    // Главные классификаторы (определяют тип стали)
    C:  1.0,   // углерод — основной классификатор (углеродистая/инструментальная)
    Cr: 0.9,   // хром — определяющий для нержавеек (≥13%) и легированных
    Ni: 0.7,   // никель — основной для аустенитных и высокопрочных конструкционных
    Mo: 0.7,   // молибден — теплостойкость, корр.стойкость (×3.3 в PREN)
    W:  0.7,   // вольфрам — определяющий для быстрорежущих

    // Существенные легирующие
    V:  0.5,   // ванадий — карбидообразователь, измельчает зерно
    Co: 0.5,   // кобальт — для теплостойких быстрорезов
    Mn: 0.5,   // марганец — прокаливаемость + раскислитель
    Si: 0.4,   // кремний — упругость (пружинные), раскислитель
    Ti: 0.4,   // титан — стабилизация (нержавейки 321-типа), микролегирование
    Al: 0.3,   // алюминий — азотируемые стали (38Х2МЮА)

    // Примеси и малые добавки
    Cu: 0.2,   // медь — обычно остаточная примесь
    P:  0.1,   // фосфор — вредная примесь, хладноломкость
    S:  0.1,   // сера — вредная примесь, красноломкость
    As: 0.05,  // мышьяк — вредная примесь
};

/**
 * =========================
 * CHEMISTRY SIMILARITY
 * =========================
 * Сравнение всей химической композиции двух марок (взвешенное среднее по элементам).
 * Опциональные элементы (Ti/W/Co/Al/As), отсутствующие в одной из сталей, пропускаются.
 */
export const compareChem = (a: Steel, b: Steel): number => {
    let sum = 0;
    let totalWeight = 0;

    // Объединение ключей обеих сталей — иначе compareChem(a, b) был бы
    // несимметричен (опциональные элементы у b, отсутствующие у a, пропускались).
    const keys = [
        ...new Set([
            ...Object.keys(a.chemical_composition),
            ...Object.keys(b.chemical_composition),
        ]),
    ] as (keyof ChemicalComposition)[];

    for (const key of keys) {
        const aValue = a.chemical_composition[key];
        const bValue = b.chemical_composition[key];

        // Пропускаем опциональные элементы, отсутствующие у одной из сталей.
        if (!aValue || !bValue) continue;

        const sim = compareRange(aValue, bValue);
        const weight = chemicalWeights[key] ?? DEFAULT_WEIGHT;

        sum += sim * weight;
        totalWeight += weight;
    }

    return totalWeight === 0 ? 0 : sum / totalWeight;
};

/**
 * =========================
 * MAIN SIMILARITY ENGINE
 * =========================
 * Считает агрегированную похожесть двух марок в диапазоне [0..1].
 * Учитывает 2 фактора: химию (через compareChem) и предел текучести.
 * Возвращает {similarity, details} — details пригоден для отладки/вывода.
 */
export const calculateSimilarity = (a: Steel, b: Steel) => {
    let score = 0;
    let totalWeight = 0;

    // 1. Химия — взвешенная сумма по всем элементам (см. compareChem).
    //    Используем единый chemistry-score вместо отдельных C/Mn —
    //    так учитываются все легирующие (Cr/Ni/Mo/W/V/Co/Ti/Al и т.д.).
    const chemSim = compareChem(a, b);
    score += chemSim * WEIGHTS.chemistry;
    totalWeight += WEIGHTS.chemistry;

    // 2. Предел текучести — учитывается только при наличии у обеих марок.
    // MAX_DIFF = 800 МПа: разница ≥800 считается "максимально различной".
    let Ysim = 0;
    const ay = a.mechanical_properties.yield_strength_mpa;
    const by = b.mechanical_properties.yield_strength_mpa;

    if (ay !== null && by !== null) {
        const MAX_DIFF = 800;
        const diff = Math.abs(ay - by);
        Ysim = 1 - Math.min(1, diff / MAX_DIFF);
        score += Ysim * WEIGHTS.yield;
        totalWeight += WEIGHTS.yield;
    }

    // Финальная нормализация: гарантирует диапазон [0..1] даже когда какой-то
    // параметр был пропущен (его вес не вошёл в totalWeight).
    const similarity = totalWeight === 0 ? 0 : score / totalWeight;

    return {
        similarity,
        details: { chemSim, Ysim, weights: WEIGHTS },
    };
};

/**
 * =========================
 * PUBLIC API
 * =========================
 */

/** Сравнить две марки по именам. Возвращает null если хотя бы одна не найдена. */
export const compareSteel = (aName: string, bName: string) => {
    const a = getSteel(aName);
    const b = getSteel(bName);
    if (!a || !b) return null;
    return calculateSimilarity(a, b);
};

/**
 * Найти все марки, отсортированные по убыванию похожести на заданную.
 * Сама исходная марка исключается из результата.
 */
export const findSimilar = (name: string) => {
    const base = getSteel(name);
    if (!base) return null;

    return steels
        .filter((s) => s.name !== base.name)
        .map((s) => ({
            steel: s.name,
            similarity: calculateSimilarity(s, base).similarity,
        }))
        .sort((a, b) => b.similarity - a.similarity);
};
