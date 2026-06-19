import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validateDb, BASE_ELEMENTS } from "../scripts/db_rules.mjs";
import { steels } from "../src/db.js";

const db = JSON.parse(
    readFileSync(fileURLToPath(new URL("../src/steels_base.json", import.meta.url)), "utf8"),
) as { steels: typeof steels };

/**
 * =========================
 * Database schema validation
 * =========================
 * Прогоняет всю БД через единый набор правил (scripts/db_rules.mjs):
 * структура, диапазоны (0≤min≤max, % и механика в норме), уникальность,
 * допустимые категории/элементы, σт≤σв.
 */
describe("database schema validation", () => {
    it("passes all structural and range rules", () => {
        const issues = validateDb(db);
        // При провале expect покажет конкретные нарушения.
        expect(issues).toEqual([]);
    });

    it("rules catch a corrupted grade (min > max)", () => {
        const broken = structuredClone(db);
        broken.steels[0].chemical_composition.C = { min: 0.5, max: 0.1 };
        expect(validateDb(broken).some((i) => /min.*>.*max/.test(i))).toBe(true);
    });

    it("rules catch σт > σв", () => {
        const broken = structuredClone(db);
        broken.steels[0].mechanical_properties.yield_strength_mpa = 9000;
        broken.steels[0].mechanical_properties.tensile_strength_mpa = 100;
        expect(validateDb(broken).some((i) => /σт.*>.*σв/.test(i))).toBe(true);
    });

    it("every grade exposes all base elements", () => {
        for (const s of steels) {
            for (const el of BASE_ELEMENTS) {
                expect(s.chemical_composition).toHaveProperty(el);
            }
        }
    });
});
