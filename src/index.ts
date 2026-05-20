import rawData from "./steels_base.json";
export type MinMax = { min: number | null; max: number | null };
export type SteelCategory =
  | "конструкционная углеродистая"
  | "конструкционная легированная"
  | "рессорно-пружинная"
  | "подшипниковая"
  | "инструментальная углеродистая"
  | "инструментальная легированная"
  | "быстрорежущая"
  | "коррозионностойкая";
export type SteelStandards = {
  aisi: string | null;
  din_en: string | null;
  gost: string;
  jis: string | null;
};
export type ChemicalComposition = {
  C: MinMax;
  Cr: MinMax;
  Mo: MinMax;
  V: MinMax;
  Mn: MinMax;
  Si: MinMax;
  Ni: MinMax;
  P: MinMax;
  S: MinMax;
  Cu: MinMax;
  Ti?: MinMax;
  W?: MinMax;
  Co?: MinMax;
  Al?: MinMax;
  As?: MinMax;
};
export type MechanicalProperties = {
  hardness_hrc: MinMax;
  hardness_hb: MinMax;
  tensile_strength_mpa: number | null;
  yield_strength_mpa: number | null;
  elongation_percent: number | null;
  impact_toughness_j_cm2: number | null;
};
export type PhysicalProperties = {
  density_g_cm3: number | null;
  thermal_conductivity_w_mk: number | null;
};
export type Steel = {
  id: string;
  name: string;
  category: SteelCategory;
  standards: SteelStandards;
  chemical_composition: ChemicalComposition;
  mechanical_properties: MechanicalProperties;
  physical_properties: PhysicalProperties;
  description: string;
};
export type SteelDatabase = {
  version: string;
  source_standard: string;
  _schema?: Record<string, unknown>;
  steels: Steel[];
};
const db = rawData as unknown as SteelDatabase;
export const steels: Steel[] = db.steels;

/**
 * =========================
 * FIND STEEL
 * =========================
 */

// ищет сталь по имени
export const getSteel = (name: string): Steel | undefined =>
  steels.find((s) => s.name === name);

/**
 * =========================
 * RANGE COMPARISON CORE
 * =========================
 */

/**
 * Сравнение двух диапазонов (MinMax → MinMax)
 *
 * Возвращает:
 * 0   → полностью разные
 * 1   → полностью совпадают
 * 0-1 → частичное совпадение
 */
const compareRange = (a: MinMax, b: MinMax): number => {
  // если нет данных — сравнивать невозможно
  if (a.min === null || a.max === null || b.min === null || b.max === null)
    return 0;

  // пересечение диапазонов
  const overlapRaw = Math.min(a.max, b.max) - Math.max(a.min, b.min);
  const overlap = Math.max(0, overlapRaw);

  // центр диапазонов (среднее значение)
  const aCenter = (a.min + a.max) / 2;
  const bCenter = (b.min + b.max) / 2;

  // общий диапазон покрытия
  const maxRange = Math.max(a.max, b.max) - Math.min(a.min, b.min);

  if (maxRange === 0) return 1;

  // разница центров
  const centerDiff = Math.abs(aCenter - bCenter);

  /**
   * overlapScore — насколько диапазоны реально пересекаются
   * centerScore  — насколько близки средние значения
   */
  const overlapScore = overlap / maxRange;
  const centerScore = 1 - Math.min(1, centerDiff / maxRange);

  // итог: гибридная метрика (реалистичнее чем только overlap)
  return overlapScore * 0.7 + centerScore * 0.3;
};

/**
 * =========================
 * WEIGHTS (важность параметров)
 * =========================
 */

const WEIGHTS = {
  carbon: 0.8, // главный элемент стали
  manganese: 0.05, // вторичный технологический элемент
  yield: 0.15, // механическая прочность
};

const chemicalWeights: Record<string, number> = {
  C: 1,
  Mn:0.6,
  Cr:0.8,
  Si:0.5,

 }

const compareChem = (a: Steel, b: Steel) => {
  let sum = 0;
  let totalWeight = 0;
  
  const keys = Object.keys(a.chemical_composition) as (keyof ChemicalComposition)[];

  for (const key of keys){

    const aValue = a.chemical_composition[key];
    const bValue = b.chemical_composition[key];

    if(aValue === null || bValue === null) continue;
    if(aValue === undefined || bValue === undefined) continue;

    const sim = compareRange(aValue, bValue);

    const weight = chemicalWeights[key] ?? 1;

    sum += sim * weight;
    totalWeight += weight;
  }

  return totalWeight === 0 ? 0 : sum/totalWeight; 

};

/**
 * =========================
 * MAIN SIMILARITY ENGINE
 * =========================
 */

/**
 * Считает сходство двух сталей (0–1)
 */
export const calculateSimilarity = (a: Steel, b: Steel) => {
  let score = 0;
  let totalWeight = 0;

  /**
   * =========================
   * 1. УГЛЕРОД (главный фактор)
   * =========================
   */
  const Csim = compareRange(a.chemical_composition.C, b.chemical_composition.C);

  score += Csim * WEIGHTS.carbon;
  totalWeight += WEIGHTS.carbon;

  /**
   * =========================
   * 2. МАРГАНЕЦ (вспомогательный)
   * =========================
   */
  const Mnsim = compareRange(
    a.chemical_composition.Mn,
    b.chemical_composition.Mn
  );

  score += Mnsim * WEIGHTS.manganese;
  totalWeight += WEIGHTS.manganese;

  /**
   * =========================
   * 3. ПРЕДЕЛ ТЕКУЧЕСТИ
   * =========================
   */

  let Ysim = 0;

  const ay = a.mechanical_properties.yield_strength_mpa;
  const by = b.mechanical_properties.yield_strength_mpa;

  if (ay !== null && by !== null) {
    const diff = Math.abs(ay - by);

    // нормализация (чем больше разница, тем хуже)
    const MAX_DIFF = 800;

    Ysim = 1 - Math.min(1, diff / MAX_DIFF);

    score += Ysim * WEIGHTS.yield;
    totalWeight += WEIGHTS.yield;
  }

  /**
   * =========================
   * 4. ФИНАЛЬНАЯ НОРМАЛИЗАЦИЯ
   * =========================
   */

  const similarity = totalWeight === 0 ? 0 : score / totalWeight;

  return {
    similarity,
    details: {
      Csim,
      Mnsim,
      Ysim,
      weights: WEIGHTS,
    },
  };
};

/**
 * =========================
 * COMPARE TWO STEELS
 * =========================
 */

export const compareSteel = (aName: string, bName: string) => {
  const a = getSteel(aName);
  const b = getSteel(bName);

  if (!a || !b) return null;

  return calculateSimilarity(a, b);
};

/**
 * =========================
 * FIND MOST SIMILAR STEELS
 * =========================
 */

/**
 * Возвращает список сталей,
 * отсортированных по похожести к заданной
 */
export const findSimilar = (name: string) => {
  const base = getSteel(name);
  if (!base) return null;

  return steels
    .filter((s) => s.name !== base.name)
    .map((steel) => {
      const result = calculateSimilarity(steel, base);

      return {
        steel: steel.name,
        similarity: result.similarity,
      };
    })
    .sort((a, b) => b.similarity - a.similarity);
};

/**
 * =========================
 * TEST
 * =========================
 */

console.log(compareSteel("Ст3", "50"));
// console.log(findSimilar("Ст3"));
