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
```

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

v0.1.0 ships with **60 GOST grades** across categories:

- **Carbon construction** — Ст3, Ст5, Сталь 10–60
- **Alloy structural** — 20Х, 40Х, 30ХГСА, 40ХН, 12ХН3А, 40ХН2МА, 38Х2МЮА, etc.
- **Spring** — 65Г, 60С2А, 50ХФА, 70С3А
- **Bearing** — ШХ15, ШХ15СГ
- **Tool carbon** — У7, У8, У9, У10, У12
- **Tool alloy** — ХВГ, 5ХНМ, 4Х5МФС, Х12, Х12МФ, Х12Ф1, 9ХС
- **High-speed** — Р6М5, Р18, Р6М5К5
- **Stainless** — 08Х18Н10, 08Х18Н10Т, 12Х18Н10Т, 12Х13, 20Х13, 40Х13, 10Х17Н13М2Т

Foreign standards (AISI / DIN-EN / JIS) are included as cross-reference fields on each grade. Standalone non-GOST entries are planned for v0.2.0.

## Roadmap

- **v0.2.0** — search by AISI/DIN/JIS, `explainSimilarity()`, test suite, more grades
- **v1.0.0** — stable API, CLI (`npx steel-lib compare <a> <b>`), full JSDoc

## License

MIT — see [LICENSE](./LICENSE).
