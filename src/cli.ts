#!/usr/bin/env node
/**
 * =========================
 * CLI
 * =========================
 * Доступ к движку из терминала без JS-проекта:
 *   steel-lib compare 40Х 45Х
 *   steel-lib similar Ст3 -n 5
 *   steel-lib find --has Cr,Ni --min-tensile 900
 *
 * Zero-dependency: разбор аргументов вручную, вывод — простой текст.
 */
import { readFileSync } from "node:fs";
import { compareSteel, findSimilar } from "./similarity.js";
import { getSteel } from "./db.js";
import { explainSimilarity, type ExplainLang } from "./explain.js";
import { findBy, type SteelFilter, type ElementSymbol } from "./filter.js";
import { calcPREN, calcCEV } from "./metrics.js";
import type { MinMax, Steel, SteelCategory } from "./types.js";

const pkg = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };

const args = process.argv.slice(2);
const pct = (x: number): string => `${Math.round(x * 100)}%`;

const HELP = `steel-lib ${pkg.version} — сравнение и подбор марок сталей по ГОСТ

Использование:
  steel-lib compare <A> <B>          похожесть двух марок
  steel-lib explain <A> <B> [--en]   разбор отличий по факторам
  steel-lib similar <марка> [-n N]   N ближайших аналогов (по умолч. 10)
  steel-lib info <марка>             карточка марки (состав, механика, PREN/CEV)
  steel-lib find [фильтры]           подбор марок под критерии
  steel-lib --help | --version

Фильтры для find:
  --category <класс>     класс стали (точное имя из БД)
  --has <Cr,Ni>          легирована элементами (через запятую)
  --min-tensile <МПа>    --max-tensile <МПа>
  --min-carbon <%>       --max-carbon <%>

Примеры:
  steel-lib compare 40Х 45Х
  steel-lib similar Ст3 -n 5
  steel-lib find --has Cr,Ni --min-tensile 900`;

function fail(msg: string): never {
    console.error(`Ошибка: ${msg}`);
    process.exit(1);
}

function need(name: string): Steel {
    const s = getSteel(name);
    if (!s) fail(`марка "${name}" не найдена (нужно точное имя, напр. "40Х", "12Х18Н10Т")`);
    return s;
}

/** Значение флага вида `--name value`. */
function flag(name: string): string | undefined {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
}

/** Человекочитаемый диапазон: `0.8–1.1`, `≤0.3`, `≥0.5`, `0.25` или null если нет данных. */
function fmtRange(mm: MinMax): string | null {
    if (mm.min === null && mm.max === null) return null;
    if (mm.min === null) return `≤${mm.max}`;
    if (mm.max === null) return `≥${mm.min}`;
    if (mm.min === mm.max) return `${mm.min}`;
    return `${mm.min}–${mm.max}`;
}

function printInfo(s: Steel): void {
    console.log(`${s.name} — ${s.category}`);

    const st = s.standards;
    const stds = ([["ГОСТ", st.gost], ["AISI", st.aisi], ["DIN-EN", st.din_en], ["JIS", st.jis]] as const)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join("  ");
    console.log(`Стандарты: ${stds}`);

    const chem = Object.entries(s.chemical_composition)
        .map(([el, mm]) => [el, fmtRange(mm as MinMax)] as const)
        .filter(([, v]) => v)
        .map(([el, v]) => `${el} ${v}`)
        .join(", ");
    console.log(`Состав, %: ${chem}`);

    const mp = s.mechanical_properties;
    const mech: string[] = [];
    if (mp.tensile_strength_mpa !== null) mech.push(`σв ${mp.tensile_strength_mpa} МПа`);
    if (mp.yield_strength_mpa !== null) mech.push(`σт ${mp.yield_strength_mpa} МПа`);
    const hb = fmtRange(mp.hardness_hb);
    if (hb) mech.push(`HB ${hb}`);
    const hrc = fmtRange(mp.hardness_hrc);
    if (hrc) mech.push(`HRC ${hrc}`);
    if (mp.elongation_percent !== null) mech.push(`δ ${mp.elongation_percent}%`);
    console.log(`Механика: ${mech.join(", ")}`);

    console.log(`PREN: ${calcPREN(s).toFixed(1)}   CEV: ${calcCEV(s).toFixed(2)}`);
    console.log(s.description);
}

function buildFilter(): SteelFilter {
    const f: SteelFilter = {};
    const cat = flag("--category");
    if (cat) f.category = cat as SteelCategory;
    const has = flag("--has");
    if (has) f.hasElement = has.split(",").map((x) => x.trim()) as ElementSymbol[];
    const minT = flag("--min-tensile");
    if (minT) f.minTensile = Number(minT);
    const maxT = flag("--max-tensile");
    if (maxT) f.maxTensile = Number(maxT);
    const minC = flag("--min-carbon");
    if (minC) f.minCarbon = Number(minC);
    const maxC = flag("--max-carbon");
    if (maxC) f.maxCarbon = Number(maxC);
    return f;
}

const cmd = args[0];

switch (cmd) {
    case undefined:
    case "help":
    case "-h":
    case "--help":
        console.log(HELP);
        break;

    case "-v":
    case "--version":
        console.log(pkg.version);
        break;

    case "compare": {
        const [, a, b] = args;
        if (!a || !b) fail("нужно две марки: steel-lib compare <A> <B>");
        need(a);
        need(b);
        const res = compareSteel(a, b)!;
        console.log(`${a} vs ${b} → ${pct(res.similarity)} похожи`);
        break;
    }

    case "explain": {
        const [, a, b] = args;
        if (!a || !b) fail("нужно две марки: steel-lib explain <A> <B>");
        need(a);
        need(b);
        const lang: ExplainLang = args.includes("--en") ? "en" : "ru";
        const ex = explainSimilarity(a, b, { lang })!;
        console.log(ex.summary);
        for (const fac of ex.factors) console.log(`  ${fac.text}`);
        break;
    }

    case "similar": {
        const name = args[1];
        if (!name || name.startsWith("-")) fail("нужно имя марки: steel-lib similar <марка>");
        need(name);
        const nRaw = flag("-n") ?? flag("--top");
        const n = nRaw ? Math.max(1, parseInt(nRaw, 10) || 10) : 10;
        findSimilar(name)!
            .slice(0, n)
            .forEach((r, i) => {
                console.log(`${String(i + 1).padStart(2)}. ${r.steel.padEnd(14)} ${pct(r.similarity)}`);
            });
        break;
    }

    case "info": {
        const name = args[1];
        if (!name) fail("нужно имя марки: steel-lib info <марка>");
        printInfo(need(name));
        break;
    }

    case "find": {
        const res = findBy(buildFilter());
        console.log(`Найдено: ${res.length}`);
        for (const s of res) console.log(`  ${s.name}  (${s.category})`);
        break;
    }

    default:
        fail(`неизвестная команда "${cmd}". steel-lib --help`);
}
