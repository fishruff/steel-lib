import { describe, it, expect } from "vitest";
import { findBy, matchesFilter } from "../src/filter.js";
import { getSteel, steels } from "../src/db.js";

const names = (arr: { name: string }[]) => arr.map((s) => s.name);

/**
 * =========================
 * findBy — базовое поведение
 * =========================
 */
describe("findBy — basics", () => {
    it("returns all grades for an empty filter", () => {
        expect(findBy({})).toHaveLength(steels.length);
        expect(findBy()).toHaveLength(steels.length);
    });

    it("returns full Steel objects, not just names", () => {
        const [first] = findBy({ category: "быстрорежущая" });
        expect(first).toHaveProperty("chemical_composition");
        expect(first).toHaveProperty("standards");
    });

    it("returns an empty array for contradictory criteria", () => {
        expect(findBy({ minTensile: 5000 })).toEqual([]);
    });
});

/**
 * =========================
 * findBy — категория
 * =========================
 */
describe("findBy — category", () => {
    it("filters by a single category", () => {
        const result = findBy({ category: "коррозионностойкая" });
        expect(result.length).toBeGreaterThan(0);
        expect(result.every((s) => s.category === "коррозионностойкая")).toBe(true);
    });

    it("treats a category array as OR", () => {
        const result = findBy({ category: ["быстрорежущая", "подшипниковая"] });
        expect(result.every((s) => ["быстрорежущая", "подшипниковая"].includes(s.category))).toBe(true);
        expect(names(result)).toContain("ШХ15");
        expect(names(result)).toContain("Р6М5");
    });
});

/**
 * =========================
 * findBy — механические пороги
 * =========================
 */
describe("findBy — mechanical thresholds", () => {
    it("minTensile keeps only grades at/above the threshold", () => {
        const result = findBy({ minTensile: 900 });
        expect(result.length).toBeGreaterThan(0);
        expect(result.every((s) => (s.mechanical_properties.tensile_strength_mpa ?? 0) >= 900)).toBe(true);
    });

    it("excludes grades that lack the constrained property (null)", () => {
        // У многих марок не нормирован σт по HRC — критерий по HRC их отсеивает.
        const result = findBy({ minHardnessHrc: 50 });
        expect(result.every((s) => s.mechanical_properties.hardness_hrc.min !== null)).toBe(true);
    });
});

/**
 * =========================
 * findBy — углерод (границы)
 * =========================
 */
describe("findBy — carbon bounds", () => {
    it("maxCarbon checks the guaranteed upper bound", () => {
        const result = findBy({ category: "конструкционная углеродистая", maxCarbon: 0.25 });
        expect(names(result)).toEqual(expect.arrayContaining(["Сталь 20", "Ст3", "Сталь 10", "Сталь 15"]));
        expect(names(result)).not.toContain("Сталь 45");
        expect(result.every((s) => (s.chemical_composition.C.max ?? Infinity) <= 0.25)).toBe(true);
    });
});

/**
 * =========================
 * findBy — легирование
 * =========================
 */
describe("findBy — alloying", () => {
    it("hasElement excludes grades where the element is only a residual (Max X)", () => {
        const result = names(findBy({ hasElement: "Cr" }));
        expect(result).toContain("40Х");       // Cr 0.8–1.1 — легирована
        expect(result).not.toContain("Сталь 20"); // Cr «Max 0.25» — остаточный
    });

    it("hasElement array requires ALL listed elements (AND)", () => {
        const result = findBy({ hasElement: ["Cr", "Ni"] });
        expect(result.every((s) => isAlloyed(s, "Cr") && isAlloyed(s, "Ni"))).toBe(true);
        expect(names(result)).toContain("12Х18Н10Т");
        expect(names(result)).not.toContain("40Х"); // легирована Cr, но не Ni
    });

    it("minElement checks the guaranteed lower bound", () => {
        const result = findBy({ minElement: { Cr: 12 } });
        expect(names(result)).toContain("12Х18Н10Т");
        expect(names(result)).toContain("20Х13");
        expect(names(result)).not.toContain("40Х"); // Cr ~0.95 < 12
        expect(result.every((s) => (s.chemical_composition.Cr.min ?? -1) >= 12)).toBe(true);
    });

    it("maxElement checks the guaranteed upper bound", () => {
        const result = findBy({ maxElement: { S: 0.025 } });
        expect(result.length).toBeGreaterThan(0);
        expect(result.every((s) => (s.chemical_composition.S.max ?? Infinity) <= 0.025)).toBe(true);
    });
});

/**
 * =========================
 * findBy — комбинация (AND) и matchesFilter
 * =========================
 */
describe("findBy — AND composition", () => {
    it("combines criteria with AND (narrows the result)", () => {
        const broad = findBy({ hasElement: "Cr" });
        const narrow = findBy({ hasElement: "Cr", minTensile: 900 });
        expect(narrow.length).toBeLessThan(broad.length);
        expect(narrow.every((s) => names(broad).includes(s.name))).toBe(true);
    });

    it("matchesFilter is the per-steel predicate behind findBy", () => {
        const s = getSteel("40Х")!;
        expect(matchesFilter(s, { hasElement: "Cr" })).toBe(true);
        expect(matchesFilter(s, { minElement: { Cr: 12 } })).toBe(false);
        expect(matchesFilter(s, {})).toBe(true);
    });
});

/** Локальный хелпер для проверок (дублирует семантику isAlloyedWith из filter.ts). */
function isAlloyed(s: (typeof steels)[number], sym: "Cr" | "Ni"): boolean {
    const mm = s.chemical_composition[sym];
    return !!mm && mm.min !== null && mm.min > 0;
}
