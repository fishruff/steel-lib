import { describe, it, expect } from "vitest";
import {
    compareRange,
    compareChem,
    calculateSimilarity,
    compareSteel,
    findSimilar,
} from "../src/similarity.js";
import { explainSimilarity } from "../src/explain.js";
import { getSteel, getSteelById, getSteelByStandard, steels } from "../src/db.js";

/**
 * =========================
 * compareRange — двусторонние диапазоны {min, max}
 * =========================
 */
describe("compareRange — two-sided ranges", () => {
    it("returns 1 for identical ranges", () => {
        expect(compareRange({ min: 0.1, max: 0.3 }, { min: 0.1, max: 0.3 })).toBe(1);
    });

    it("returns 1 for identical point ranges (min === max)", () => {
        expect(compareRange({ min: 0.5, max: 0.5 }, { min: 0.5, max: 0.5 })).toBe(1);
    });

    it("returns near-zero for far-apart ranges", () => {
        // [0, 1] vs [100, 101] — overlap=0, центры далеко
        const r = compareRange({ min: 0, max: 1 }, { min: 100, max: 101 });
        expect(r).toBeLessThan(0.05);
    });

    it("returns higher score for closer ranges than far ones", () => {
        const close = compareRange({ min: 0.2, max: 0.3 }, { min: 0.22, max: 0.28 });
        const far = compareRange({ min: 0.2, max: 0.3 }, { min: 0.9, max: 1.0 });
        expect(close).toBeGreaterThan(far);
    });

    it("returns value in [0..1] for partially overlapping ranges", () => {
        const r = compareRange({ min: 0, max: 1 }, { min: 0.5, max: 1.5 });
        expect(r).toBeGreaterThan(0);
        expect(r).toBeLessThan(1);
    });
});

/**
 * =========================
 * compareRange — односторонние диапазоны
 * =========================
 */
describe("compareRange — one-sided ranges", () => {
    it("returns 1 for identical {null, max} ranges", () => {
        expect(compareRange({ min: null, max: 0.30 }, { min: null, max: 0.30 })).toBe(1);
    });

    it("returns 1 for both {null, 0}", () => {
        expect(compareRange({ min: null, max: 0 }, { min: null, max: 0 })).toBe(1);
    });

    it("returns 1 for identical {min, null} ranges", () => {
        expect(compareRange({ min: 0.7, max: null }, { min: 0.7, max: null })).toBe(1);
    });

    it("returns value in (0..1) for different {null, max}", () => {
        const r = compareRange({ min: null, max: 0.30 }, { min: null, max: 0.10 });
        expect(r).toBeGreaterThan(0);
        expect(r).toBeLessThan(1);
    });

    it("returns 0 for incompatible shapes (one min-only, other max-only)", () => {
        expect(compareRange({ min: 0.5, max: null }, { min: null, max: 0.5 })).toBe(0);
    });
});

/**
 * =========================
 * compareRange — null-кейсы
 * =========================
 */
describe("compareRange — null cases", () => {
    it("returns 0 if any range is fully null", () => {
        expect(compareRange({ min: null, max: null }, { min: 0.1, max: 0.3 })).toBe(0);
        expect(compareRange({ min: 0.1, max: 0.3 }, { min: null, max: null })).toBe(0);
    });
});

/**
 * =========================
 * compareChem
 * =========================
 */
describe("compareChem", () => {
    it("returns 1 for a steel compared with itself", () => {
        const steel = getSteel("Ст3")!;
        expect(compareChem(steel, steel)).toBeCloseTo(1, 5);
    });

    it("is symmetric: compareChem(a, b) === compareChem(b, a)", () => {
        const a = getSteel("40Х")!;
        const b = getSteel("12Х18Н10Т")!;
        expect(compareChem(a, b)).toBeCloseTo(compareChem(b, a), 10);
    });

    it("returns value in [0..1] for any two steels", () => {
        const a = getSteel("Ст3")!;
        const b = getSteel("Р6М5")!;
        const r = compareChem(a, b);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(1);
    });
});

/**
 * =========================
 * calculateSimilarity
 * =========================
 */
describe("calculateSimilarity", () => {
    it("returns similarity 1 for a steel compared with itself", () => {
        const s = getSteel("40Х")!;
        const { similarity } = calculateSimilarity(s, s);
        expect(similarity).toBeCloseTo(1, 5);
    });

    it("returns low similarity for chemically very different grades", () => {
        const a = getSteel("Ст3")!;        // углеродистая
        const b = getSteel("12Х18Н10Т")!;  // аустенитная нержавейка
        const { similarity } = calculateSimilarity(a, b);
        expect(similarity).toBeLessThan(0.6);
    });

    it("similar grades score higher than dissimilar ones", () => {
        const base = getSteel("40Х")!;
        const similar = calculateSimilarity(base, getSteel("45Х")!).similarity;
        const different = calculateSimilarity(base, getSteel("12Х18Н10Т")!).similarity;
        expect(similar).toBeGreaterThan(different);
    });

    it("details has chemSim, Ysim, weights", () => {
        const a = getSteel("Ст3")!;
        const b = getSteel("Сталь 45")!;
        const { details } = calculateSimilarity(a, b);
        expect(details).toHaveProperty("chemSim");
        expect(details).toHaveProperty("Ysim");
        expect(details).toHaveProperty("weights");
    });

    // Snapshot-страховка: фиксирует итог для известной пары марок.
    // Если сдвиг весов/алгоритма меняет это число — тест падает осознанно.
    it("scores a known pair (Сталь 20 vs Сталь 45) at a stable value", () => {
        const a = getSteel("Сталь 20")!;
        const b = getSteel("Сталь 45")!;
        const { similarity } = calculateSimilarity(a, b);
        expect(similarity).toBeCloseTo(0.7179, 3);
    });
});

/**
 * =========================
 * compareSteel
 * =========================
 */
describe("compareSteel", () => {
    it("returns result for valid grade names", () => {
        const r = compareSteel("40Х", "45Х");
        expect(r).not.toBeNull();
        expect(r!.similarity).toBeGreaterThan(0);
    });

    it("returns null for unknown first grade", () => {
        expect(compareSteel("nope", "40Х")).toBeNull();
    });

    it("returns null for unknown second grade", () => {
        expect(compareSteel("40Х", "nope")).toBeNull();
    });
});

/**
 * =========================
 * findSimilar
 * =========================
 */
describe("findSimilar", () => {
    it("returns array sorted by descending similarity", () => {
        const result = findSimilar("Ст3")!;
        for (let i = 1; i < result.length; i++) {
            expect(result[i - 1].similarity).toBeGreaterThanOrEqual(result[i].similarity);
        }
    });

    it("does not include the base steel itself", () => {
        const result = findSimilar("Ст3")!;
        expect(result.find((r) => r.steel === "Ст3")).toBeUndefined();
    });

    it("returns null for unknown steel name", () => {
        expect(findSimilar("UnknownGrade")).toBeNull();
    });

    it("returns N-1 entries (where N is total grades)", () => {
        const result = findSimilar("Ст3")!;
        expect(result).toHaveLength(steels.length - 1);
    });

    // Регрессия: для рядовой углеродистой Ст3 ближайшими должны быть
    // другие низкоуглеродистые конструкционные (Сталь 20 / Сталь 15),
    // а не легированные/нержавеющие. Ловит «молчаливую» поломку весов.
    it("ranks plain low-carbon grades highest for Ст3", () => {
        const top3 = findSimilar("Ст3")!.slice(0, 3).map((r) => r.steel);
        expect(top3[0]).toBe("Сталь 20");
        expect(top3).toContain("Сталь 15");
    });
});

/**
 * =========================
 * getSteel / getSteelById
 * =========================
 */
describe("getSteel / getSteelById", () => {
    it("getSteel returns the grade for a known name", () => {
        const s = getSteel("Ст3");
        expect(s).toBeDefined();
        expect(s!.name).toBe("Ст3");
    });

    it("getSteel returns undefined for unknown name", () => {
        expect(getSteel("UnknownGrade")).toBeUndefined();
    });

    it("getSteelById returns the grade for a known id", () => {
        const s = getSteelById("gost-st3");
        expect(s).toBeDefined();
        expect(s!.name).toBe("Ст3");
    });

    it("getSteelById returns undefined for unknown id", () => {
        expect(getSteelById("unknown-id")).toBeUndefined();
    });
});

/**
 * =========================
 * getSteelByStandard
 * =========================
 */
describe("getSteelByStandard", () => {
    it("finds steel by AISI code (clean number)", () => {
        const s = getSteelByStandard("304");
        expect(s).toBeDefined();
        expect(s!.standards.aisi).toBe("304");
    });

    it("finds steel by AISI letter code (D2)", () => {
        const s = getSteelByStandard("D2");
        expect(s).toBeDefined();
        expect(s!.standards.aisi).toBe("D2");
    });

    it("is case-insensitive", () => {
        const lower = getSteelByStandard("d2");
        const upper = getSteelByStandard("D2");
        expect(lower).toBe(upper);
    });

    it("finds steel by JIS code", () => {
        const s = getSteelByStandard("SUS304");
        expect(s).toBeDefined();
        expect(s!.standards.jis).toBe("SUS304");
    });

    it("finds steel by DIN-EN Werkstoff number (1.4541)", () => {
        const s = getSteelByStandard("1.4541");
        expect(s).toBeDefined();
        expect(s!.standards.din_en).toContain("1.4541");
    });

    it("finds steel by DIN-EN prefix (C45)", () => {
        const s = getSteelByStandard("C45");
        expect(s).toBeDefined();
        expect(s!.standards.din_en).toContain("C45");
    });

    it("finds steel by AISI even with annotation in stored value", () => {
        // 18ХГТ stored as aisi: "5115 (близкий)" — should still match "5115"
        const s = getSteelByStandard("5115");
        expect(s).toBeDefined();
    });

    it("returns undefined for unknown standard code", () => {
        expect(getSteelByStandard("UnknownStandardCode")).toBeUndefined();
    });
});

/**
 * =========================
 * explainSimilarity
 * =========================
 */
describe("explainSimilarity", () => {
    it("returns null when a grade is unknown", () => {
        expect(explainSimilarity("nope", "Сталь 45")).toBeNull();
        expect(explainSimilarity("Сталь 45", "nope")).toBeNull();
    });

    it("summary reflects the similarity percentage (ru by default)", () => {
        const r = explainSimilarity("Сталь 20", "Сталь 45")!;
        expect(r.summary).toBe("Похожи на 72%");
    });

    it("renders English summary and labels with { lang: 'en' }", () => {
        const r = explainSimilarity("Сталь 20", "Сталь 45", { lang: "en" })!;
        expect(r.summary).toBe("72% similar");
        const carbon = r.factors.find((f) => f.key === "C")!;
        expect(carbon.text).toContain("Carbon");
    });

    it("reports carbon delta with correct sign and raw values", () => {
        const r = explainSimilarity("Сталь 20", "Сталь 45")!;
        const carbon = r.factors.find((f) => f.key === "C")!;
        expect(carbon.delta).toBeCloseTo(0.255, 3);
        expect(carbon.delta).toBeCloseTo(carbon.b! - carbon.a!, 6);
        expect(carbon.text).toBe("Углерод +0.255%");
    });

    it("marks identical elements as 'идентичен' (delta 0)", () => {
        const r = explainSimilarity("Сталь 20", "Сталь 45")!;
        const cr = r.factors.find((f) => f.key === "Cr")!;
        expect(cr.delta).toBe(0);
        expect(cr.text).toBe("Хром идентичен");
    });

    it("includes mechanical factors when both grades define them", () => {
        const r = explainSimilarity("Сталь 20", "Сталь 45")!;
        const yield_ = r.factors.find((f) => f.key === "σт")!;
        expect(yield_.text).toBe("Предел текучести +110 МПа");
    });

    it("every factor carries text, a, b and delta", () => {
        const r = explainSimilarity("40Х", "45Х")!;
        expect(r.factors.length).toBeGreaterThan(0);
        for (const f of r.factors) {
            expect(typeof f.text).toBe("string");
            expect(f.text.length).toBeGreaterThan(0);
            expect(f.delta).toBeCloseTo(f.b! - f.a!, 6);
        }
    });
});

/**
 * =========================
 * Database integrity
 * =========================
 */
describe("Database integrity", () => {
    it("contains 60 steels", () => {
        expect(steels).toHaveLength(60);
    });

    it("all steel IDs are unique", () => {
        const ids = steels.map((s) => s.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("all steel names are unique", () => {
        const names = steels.map((s) => s.name);
        expect(new Set(names).size).toBe(names.length);
    });

    it("every steel has required top-level fields", () => {
        for (const s of steels) {
            expect(s.id).toBeDefined();
            expect(s.name).toBeDefined();
            expect(s.category).toBeDefined();
            expect(s.standards.gost).toBeDefined();
            expect(s.chemical_composition.C).toBeDefined();
            expect(s.description).toBeDefined();
        }
    });

    it("every steel has all base chemical elements", () => {
        const required = ["C", "Cr", "Mo", "V", "Mn", "Si", "Ni", "P", "S", "Cu"];
        for (const s of steels) {
            for (const elem of required) {
                expect(s.chemical_composition).toHaveProperty(elem);
            }
        }
    });
});
