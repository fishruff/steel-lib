import rawData from "./steels_base.json";

export type MinMax = {
    min: number | null;
    max: number | null;
};

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

export const getSteel = (name: string): Steel | undefined =>
    steels.find((s) => s.name === name);

const avg = (r: MinMax): number => {
    if (r.min !== null && r.max !== null) return (r.min + r.max) / 2;
    return r.min ?? r.max ?? 0;
};

const compareRange = (a: MinMax, b: MinMax): number => {
    if (a.min === null || a.max === null || b.min === null || b.max === null) return 0;

    const overlap = Math.min(a.max, b.max) - Math.max(a.min, b.min);
    if (overlap < 0) return 0;

    const total = Math.max(a.max, b.max) - Math.min(a.min, b.min);
    if (total === 0) return 1;

    return overlap / total;
};

const calculateSimilarity = (a: Steel, b: Steel) => {
    const Cdiff = compareRange(a.chemical_composition.C, b.chemical_composition.C);
    const Mndiff = Math.abs(avg(a.chemical_composition.Mn) - avg(b.chemical_composition.Mn));
    const ay = a.mechanical_properties.yield_strength_mpa ?? 0;
    const by = b.mechanical_properties.yield_strength_mpa ?? 0;
    const Yielddiff = Math.abs(ay - by);

    const Csim = 1 - Cdiff / 1;
    const Mnsim = 1 - Mndiff / 2;
    const Yieldsim = 1 - Yielddiff / 1000;

    const similarity =
        Csim * 0.5 +
        Mnsim * 0.2 +
        Yieldsim * 0.3;

    return {
        similarity,
        details: { Cdiff, Mndiff, Yielddiff },
    };
};

export const compareSteel = (aName: string, bName: string) => {
    const a = getSteel(aName);
    const b = getSteel(bName);
    if (!a || !b) return null;
    return calculateSimilarity(a, b);
};

export const findSimilar = (name: string) => {
    const base = getSteel(name);
    if (!base) return null;
    return steels
        .filter((i) => i.name !== base.name)
        .map((item) => ({
            steel: item.name,
            similarity: calculateSimilarity(item, base).similarity,
        }))
        .sort((a, b) => b.similarity - a.similarity);
};

console.log(findSimilar("Ст3"));
