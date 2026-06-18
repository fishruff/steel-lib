# steel-lib

[![npm version](https://img.shields.io/npm/v/steel-lib.svg)](https://www.npmjs.com/package/steel-lib)
[![npm downloads](https://img.shields.io/npm/dm/steel-lib.svg)](https://www.npmjs.com/package/steel-lib)
[![license](https://img.shields.io/npm/l/steel-lib.svg)](./LICENSE)

> [Russian / Русский](./README.ru.md)

Engine for comparing and finding analog steel grades by GOST standards. Compares chemical composition and mechanical properties, returns a similarity coefficient in `[0, 1]`.

> **npm:** [npmjs.com/package/steel-lib](https://www.npmjs.com/package/steel-lib)

## Installation

```bash
npm install steel-lib
```

## Quick start

```ts
import { compareSteel, findSimilar, getSteel } from "steel-lib";

// Compare two grades by name
const result = compareSteel("40Х", "45Х");
console.log(result?.similarity); // ~0.85

// Find most similar grades
const similar = findSimilar("Ст3");
console.log(similar?.slice(0, 3));
// [
//   { steel: "Сталь 20", similarity: 0.92 },
//   { steel: "Сталь 10", similarity: 0.88 },
//   ...
// ]

// Access raw grade data
const steel = getSteel("12Х18Н10Т");
console.log(steel?.standards.aisi); // "321"
console.log(steel?.chemical_composition.Cr); // { min: 17, max: 19 }

// Find a GOST grade by foreign standard code
import { getSteelByStandard } from "steel-lib";
const gostGrade = getSteelByStandard("304");
console.log(gostGrade?.name); // "08Х18Н10"

// Explain why two grades are similar (ru by default, { lang: "en" } for English)
import { explainSimilarity } from "steel-lib";
const ex = explainSimilarity("Сталь 20", "Сталь 45");
console.log(ex?.summary);     // "Похожи на 72%"
console.log(ex?.factors[0]);  // { key: "C", a: 0.205, b: 0.46, delta: 0.255, text: "Углерод +0.255%" }

// Select grades by spec (AND semantics, empty filter returns all)
import { findBy } from "steel-lib";
const weldable = findBy({ category: "конструкционная легированная", maxCarbon: 0.12 });
const stainless = findBy({ minElement: { Cr: 12 } });

// Chemistry metrics
import { calcPREN, calcCEV } from "steel-lib";
calcPREN(getSteel("10Х17Н13М2Т")!); // ~25.25 — pitting resistance (Cr + 3.3·Mo)
calcCEV(getSteel("09Г2С")!);         // ~0.36 — carbon equivalent (weldability)
```

## CLI

Use it from the terminal without a JS project:

```bash
npx steel-lib compare 40Х 45Х          # 40Х vs 45Х → 85% похожи
npx steel-lib similar Ст3 -n 5          # 5 nearest analogues
npx steel-lib explain Сталь\ 20 Сталь\ 45   # factor-by-factor breakdown (--en for English)
npx steel-lib info 10Х17Н13М2Т          # grade card: composition, mechanics, PREN/CEV
npx steel-lib find --has Cr,Ni --min-tensile 900   # select grades by spec
```

`find` flags: `--category`, `--has <Cr,Ni>`, `--min-tensile` / `--max-tensile`, `--min-carbon` / `--max-carbon`. Run `steel-lib --help` for the full list.

## Use cases

- **Substitute scarce grades** — find a near-equivalent grade when the original is unavailable
- **Material selection** — narrow down grades matching required chemistry/mechanics
- **Foreign standard lookup** — read AISI / DIN-EN / JIS analogues for a given GOST grade

## API

### Lookups

| Function | Description |
|---|---|
| `getSteel(name: string)` | Find a grade by exact name (e.g., `"Ст3"`, `"40Х"`, `"12Х18Н10Т"`) |
| `getSteelById(id: string)` | Find a grade by ID (e.g., `"gost-st3"`, `"gost-40x"`) |
| `getSteelByStandard(code: string)` | Find a GOST grade by AISI/DIN-EN/JIS code (e.g., `"304"`, `"D2"`, `"1.4541"`, `"SUS321"`) |
| `steels: Steel[]` | Full array of all grades in the database |

### Comparison

| Function | Description |
|---|---|
| `compareSteel(aName, bName)` | Compare two grades by name. Returns `null` if either is not found |
| `calculateSimilarity(a, b)` | Compare two `Steel` objects directly |
| `compareChem(a, b)` | Compare chemical composition only (weighted average across elements) |
| `compareRange(a, b)` | Compare two `{min, max}` ranges. Returns `[0..1]` |
| `findSimilar(name)` | Return all grades sorted by descending similarity. Base grade is excluded |
| `explainSimilarity(aName, bName, opts?)` | Human-readable breakdown of two grades. `opts.lang: "ru" \| "en"`. Returns `{ summary, factors }` or `null` |

### Selection

| Function | Description |
|---|---|
| `findBy(filter)` | Return all `Steel` matching a filter (AND semantics). Empty filter returns all grades |
| `matchesFilter(steel, filter)` | Per-grade predicate behind `findBy` |

Filter fields (all optional): `category` (or array = OR), `min/maxTensile`, `min/maxYield`, `min/maxElongation`, `min/maxHardnessHrc`, `min/maxHardnessHb`, `min/maxCarbon`, `hasElement` (or array = AND), `minElement` / `maxElement` (`{ Cr: 0.8 }`). `min*` checks the grade's guaranteed lower bound, `max*` the upper bound.

### Metrics

| Function | Description |
|---|---|
| `calcPREN(steel)` | Pitting Resistance Equivalent: `Cr + 3.3·Mo + 16·N` (N taken as 0 — not in DB) |
| `calcCEV(steel)` | Carbon equivalent, IIW: `C + Mn/6 + (Cr+Mo+V)/5 + (Cu+Ni)/15` (weldability) |

Both use nominal (midpoint) content from the `{min, max}` ranges.

## Data model

```ts
type Steel = {
    id: string;                    // "gost-st3", "gost-40x"
    name: string;                  // "Ст3", "40Х"
    category: SteelCategory;       // "конструкционная углеродистая", etc.
    standards: {
        aisi: string | null;       // "1020", "5140", ...
        din_en: string | null;     // "C22 (1.0402)", ...
        gost: string;              // "Ст3", "40Х"
        jis: string | null;        // "SS400", "SCr440", ...
    };
    chemical_composition: {
        C: MinMax; Cr: MinMax; Mo: MinMax; V: MinMax;
        Mn: MinMax; Si: MinMax; Ni: MinMax;
        P: MinMax; S: MinMax; Cu: MinMax;
        Ti?: MinMax; W?: MinMax; Co?: MinMax;
        Al?: MinMax; As?: MinMax;
    };
    mechanical_properties: {
        hardness_hrc: MinMax;
        hardness_hb: MinMax;
        tensile_strength_mpa: number | null;
        yield_strength_mpa: number | null;
        elongation_percent: number | null;
        impact_toughness_j_cm2: number | null;
    };
    physical_properties: {
        density_g_cm3: number | null;
        thermal_conductivity_w_mk: number | null;
    };
    description: string;
};

type MinMax = { min: number | null; max: number | null };
```

## Algorithm

Hybrid range similarity:

- **Overlap score** (weight `0.7`) — IoU-like measure for `{min, max}` ranges
- **Center score** (weight `0.3`) — closeness of midpoints

Final similarity is a weighted average over chemistry elements + yield strength. Element weights are based on metallurgical importance:

- ASM Handbook Vol. 1 — alloying element influence hierarchy
- IIW Carbon Equivalent (`CEV = C + Mn/6 + (Cu+Ni)/15 + (Cr+Mo+V)/5`)
- PREN (`Cr + 3.3·Mo + 16·N`) — pitting resistance

See [`src/similarity.ts`](./src/similarity.ts) for full weight table and rationale.

## Coverage

v0.3.0 ships with **72 GOST grades** across categories:

- **Carbon construction** — Ст3, Ст5, Сталь 10–60
- **Alloy structural** — 20Х, 40Х, 30ХГСА, 40ХН, 12ХН3А, 40ХН2МА, 38Х2МЮА, etc.
- **Heat-resistant / creep-resistant** — 15Х5М, 12Х1МФ, 15ХМ, 12МХ
- **Weldable low-alloy** — 09Г2С, 10Г2С1, 16ГС, 17ГС, 15ХСНД
- **Spring** — 65Г, 60С2А, 50ХФА, 70С3А
- **Bearing** — ШХ15, ШХ15СГ
- **Tool carbon** — У7, У8, У9, У10, У12
- **Tool alloy** — ХВГ, 5ХНМ, 4Х5МФС, Х12, Х12МФ, Х12Ф1, 9ХС
- **High-speed** — Р6М5, Р18, Р6М5К5
- **Stainless / austenitic** — 08Х18Н10, 12Х18Н10Т, 12Х18Н9, 12Х13, 20Х13, 40Х13, 10Х17Н13М2Т, 10Х11Н20Т3Р, 20Х23Н18

Foreign standards (AISI / DIN-EN / JIS) are included as cross-reference fields on each grade.

> Chemical compositions follow GOST; mechanical/physical properties are representative values (depend on section size and heat treatment).

## Roadmap

- **v0.2.0** ✅ — search by AISI/DIN/JIS (`getSteelByStandard`), `explainSimilarity()`, test suite
- **v0.3.0** ✅ — `findBy()` selection engine, +12 grades, `calcPREN()` / `calcCEV()`
- **v0.4+** — CLI (`npx steel-lib compare <a> <b>`), full JSDoc, English grade descriptions
- **v1.0.0** — frozen API, documentation site

## License

MIT — see [LICENSE](./LICENSE).
