/**
 * =========================
 * CHEMISTRY METRICS
 * =========================
 * Абсолютные характеристики марки, вычисляемые из химического состава:
 *   calcPREN — стойкость к питтинговой коррозии (для нержавеющих сталей)
 *   calcCEV  — углеродный эквивалент (свариваемость)
 *
 * Состав хранится диапазонами {min, max}; в расчёте берётся НОМИНАЛЬНОЕ
 * (среднее) содержание. Ненормированная граница трактуется как 0
 * (напр. остаточный элемент «Max X» → среднее (0 + X) / 2).
 */
import type { MinMax, Steel } from "./types.js";

/**
 * Номинальное содержание элемента, %: середина нормируемого диапазона.
 * min = null → 0 (нижняя граница не нормирована), max = null → min.
 * Нет данных → 0.
 */
const nominal = (mm: MinMax | undefined): number => {
    if (!mm) return 0;
    const lo = mm.min ?? 0;
    const hi = mm.max ?? mm.min ?? 0;
    return (lo + hi) / 2;
};

/**
 * PREN — Pitting Resistance Equivalent Number (стойкость к питтинговой коррозии).
 * Формула: PREN = %Cr + 3.3·%Mo + 16·%N.
 * Азот (N) учитывается, если нормируется у марки; иначе вклад равен 0.
 * Ориентиры: <18 — обычные нержавейки, >32 — дуплексные, >40 — супер-дуплексные.
 *
 * @example calcPREN(getSteel("10Х17Н13М2Т")) // ~24
 */
export const calcPREN = (steel: Steel): number => {
    const c = steel.chemical_composition;
    return nominal(c.Cr) + 3.3 * nominal(c.Mo) + 16 * nominal(c.N);
};

/**
 * CEV (Ceq) — углеродный эквивалент по IIW/ISO 15614 (свариваемость).
 * Формула: CEV = %C + %Mn/6 + (%Cr+%Mo+%V)/5 + (%Cu+%Ni)/15.
 * Ориентиры: <0.40 — варится без подогрева, 0.40–0.60 — нужен подогрев,
 * >0.60 — трудносвариваемая.
 *
 * @example calcCEV(getSteel("09Г2С")) // ~0.45
 */
export const calcCEV = (steel: Steel): number => {
    const c = steel.chemical_composition;
    return (
        nominal(c.C) +
        nominal(c.Mn) / 6 +
        (nominal(c.Cr) + nominal(c.Mo) + nominal(c.V)) / 5 +
        (nominal(c.Cu) + nominal(c.Ni)) / 15
    );
};
