/**
 * =========================
 * RANGE
 * =========================
 * Универсальный тип "диапазон от-до" для всех числовых характеристик,
 * нормируемых стандартом как min/max (химические элементы, твёрдость).
 * null означает "граница не нормирована" или "нет данных".
 */
export type MinMax = {
    min: number | null;
    max: number | null;
};

/**
 * =========================
 * STEEL CATEGORY
 * =========================
 * Класс стали по назначению. Используется для группировки и фильтрации.
 */
export type SteelCategory =
    | "конструкционная углеродистая"
    | "конструкционная легированная"
    | "рессорно-пружинная"
    | "подшипниковая"
    | "инструментальная углеродистая"
    | "инструментальная легированная"
    | "быстрорежущая"
    | "коррозионностойкая";

/**
 * =========================
 * STANDARDS
 * =========================
 * Аналоги марки по зарубежным стандартам (AISI/SAE, DIN/EN, JIS).
 * `gost` — единственное обязательное поле, остальные null при отсутствии аналога.
 */
export type SteelStandards = {
    aisi: string | null;
    din_en: string | null;
    gost: string;
    jis: string | null;
};

/**
 * =========================
 * CHEMICAL COMPOSITION
 * =========================
 * Массовая доля каждого элемента в %.
 * Базовые 10 элементов (C..Cu) обязательны — могут иметь null-границы,
 * но ключ всегда присутствует.
 * Специфичные (Ti/W/Co/Al/As) — опциональные, появляются только у тех
 * марок, где стандарт явно их нормирует.
 */
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

/**
 * =========================
 * MECHANICAL PROPERTIES
 * =========================
 * Прочностные характеристики при ~20 °C.
 * HRC применима к закалённым сталям, HB — к отожжённым/нормализованным;
 * для одной марки обычно нормируется только одна из шкал, вторая null.
 */
export type MechanicalProperties = {
    hardness_hrc: MinMax;
    hardness_hb: MinMax;
    tensile_strength_mpa: number | null;
    yield_strength_mpa: number | null;
    elongation_percent: number | null;
    impact_toughness_j_cm2: number | null;
};

/**
 * =========================
 * PHYSICAL PROPERTIES
 * =========================
 * Физические свойства при ~20 °C.
 */
export type PhysicalProperties = {
    density_g_cm3: number | null;
    thermal_conductivity_w_mk: number | null;
};

/**
 * =========================
 * STEEL (одна марка)
 * =========================
 */
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

/**
 * =========================
 * DATABASE (корень JSON-файла)
 * =========================
 * `_schema` — справочный блок-документация полей, не используется в коде.
 */
export type SteelDatabase = {
    version: string;
    source_standard: string;
    _schema?: Record<string, unknown>;
    steels: Steel[];
};
