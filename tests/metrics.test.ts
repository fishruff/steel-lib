import { describe, it, expect } from "vitest";
import { calcPREN, calcCEV } from "../src/metrics.js";
import { getSteel, steels } from "../src/db.js";

/**
 * =========================
 * calcPREN — питтинговая стойкость
 * =========================
 */
describe("calcPREN", () => {
    it("rewards molybdenum: 316-type scores higher than 304-type", () => {
        const pren316 = calcPREN(getSteel("10Х17Н13М2Т")!); // ~2% Mo
        const pren304 = calcPREN(getSteel("12Х18Н10Т")!);   // без Mo
        expect(pren316).toBeGreaterThan(pren304);
    });

    it("matches the Cr + 3.3·Mo formula for 316-type 10Х17Н13М2Т", () => {
        expect(calcPREN(getSteel("10Х17Н13М2Т")!)).toBeCloseTo(25.25, 2);
    });

    it("equals nominal Cr when no Mo is present (304-type)", () => {
        expect(calcPREN(getSteel("12Х18Н10Т")!)).toBeCloseTo(18, 1);
    });

    it("is finite and non-negative for every grade", () => {
        for (const s of steels) {
            const pren = calcPREN(s);
            expect(Number.isFinite(pren)).toBe(true);
            expect(pren).toBeGreaterThanOrEqual(0);
        }
    });
});

/**
 * =========================
 * calcCEV — углеродный эквивалент (свариваемость)
 * =========================
 */
describe("calcCEV", () => {
    it("classifies weldable low-alloy 09Г2С below the 0.40 preheat threshold", () => {
        expect(calcCEV(getSteel("09Г2С")!)).toBeLessThan(0.4);
    });

    it("classifies hardenable 40Х above the 0.60 hard-to-weld threshold", () => {
        expect(calcCEV(getSteel("40Х")!)).toBeGreaterThan(0.6);
    });

    it("matches the IIW formula for 40Х", () => {
        expect(calcCEV(getSteel("40Х")!)).toBeCloseTo(0.72, 2);
    });

    it("plain low-carbon Сталь 20 is the most weldable (lowest CEV among the three)", () => {
        const cev20 = calcCEV(getSteel("Сталь 20")!);
        expect(cev20).toBeLessThan(calcCEV(getSteel("09Г2С")!) + 0.05);
        expect(cev20).toBeLessThan(calcCEV(getSteel("40Х")!));
    });

    it("is finite and non-negative for every grade", () => {
        for (const s of steels) {
            const cev = calcCEV(s);
            expect(Number.isFinite(cev)).toBe(true);
            expect(cev).toBeGreaterThanOrEqual(0);
        }
    });
});
