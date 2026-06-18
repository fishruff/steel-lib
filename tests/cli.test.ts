import { beforeAll, describe, it, expect } from "vitest";
import { execFileSync, execSync } from "node:child_process";

/** Запускает собранный CLI, возвращает stdout. Бросает при ненулевом коде выхода. */
const run = (...a: string[]): string =>
    execFileSync("node", ["dist/cli.js", ...a], { encoding: "utf8" });

describe("cli", () => {
    beforeAll(() => {
        // CLI тестируется на собранном dist/cli.js — гарантируем свежую сборку.
        execSync("npm run build", { stdio: "ignore" });
    }, 60000);

    it("--version prints the package version", () => {
        expect(run("--version").trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it("compare prints a similarity line", () => {
        const out = run("compare", "40Х", "45Х");
        expect(out).toMatch(/40Х vs 45Х →/);
        expect(out).toMatch(/%/);
    });

    it("similar lists N grades", () => {
        const out = run("similar", "Ст3", "-n", "3").trim();
        expect(out.split("\n")).toHaveLength(3);
        expect(out).toMatch(/Сталь 20/);
    });

    it("explain renders the summary and factors", () => {
        const out = run("explain", "Сталь 20", "Сталь 45");
        expect(out).toMatch(/Похожи на/);
        expect(out).toMatch(/Углерод/);
    });

    it("info shows standards and PREN/CEV", () => {
        const out = run("info", "10Х17Н13М2Т");
        expect(out).toMatch(/AISI: 316Ti/);
        expect(out).toMatch(/PREN:/);
        expect(out).toMatch(/CEV:/);
    });

    it("find applies filters and reports a count", () => {
        const out = run("find", "--has", "Cr,Ni", "--min-tensile", "900");
        expect(out).toMatch(/Найдено: \d+/);
        expect(out).toMatch(/40ХН/);
    });

    it("exits non-zero on an unknown grade", () => {
        expect(() => run("compare", "НетТакой", "45Х")).toThrow();
    });

    it("exits non-zero on an unknown command", () => {
        expect(() => run("frobnicate")).toThrow();
    });
});
