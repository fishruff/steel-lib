# steel-lib

[![npm version](https://img.shields.io/npm/v/steel-lib.svg)](https://www.npmjs.com/package/steel-lib)
[![npm downloads](https://img.shields.io/npm/dm/steel-lib.svg)](https://www.npmjs.com/package/steel-lib)
[![license](https://img.shields.io/npm/l/steel-lib.svg)](./LICENSE)

> [English](./README.md)

Движок для сравнения и подбора аналогов марок сталей по ГОСТ. Сравнивает химический состав и механические свойства, возвращает коэффициент похожести `[0, 1]`.

> **npm:** [npmjs.com/package/steel-lib](https://www.npmjs.com/package/steel-lib)

## Установка

```bash
npm install steel-lib
```

## Быстрый старт

```ts
import { compareSteel, findSimilar, getSteel } from "steel-lib";

// Сравнить две марки по имени
const result = compareSteel("40Х", "45Х");
console.log(result?.similarity); // ~0.85

// Найти самые похожие марки
const similar = findSimilar("Ст3");
console.log(similar?.slice(0, 3));
// [
//   { steel: "Сталь 20", similarity: 0.92 },
//   { steel: "Сталь 10", similarity: 0.88 },
//   ...
// ]

// Получить данные конкретной марки
const steel = getSteel("12Х18Н10Т");
console.log(steel?.standards.aisi); // "321"
console.log(steel?.chemical_composition.Cr); // { min: 17, max: 19 }

// Найти ГОСТ-марку по зарубежному стандарту
import { getSteelByStandard } from "steel-lib";
const gostGrade = getSteelByStandard("304");
console.log(gostGrade?.name); // "08Х18Н10"

// Объяснить, чем похожи две марки (по умолчанию ru, { lang: "en" } — англ.)
import { explainSimilarity } from "steel-lib";
const ex = explainSimilarity("Сталь 20", "Сталь 45");
console.log(ex?.summary);     // "Похожи на 72%"
console.log(ex?.factors[0]);  // { key: "C", a: 0.205, b: 0.46, delta: 0.255, text: "Углерод +0.255%" }

// Подбор марок под ТЗ (семантика AND, пустой фильтр — все марки)
import { findBy } from "steel-lib";
const weldable = findBy({ category: "конструкционная легированная", maxCarbon: 0.12 });
const stainless = findBy({ minElement: { Cr: 12 } });

// Индексы по составу
import { calcPREN, calcCEV } from "steel-lib";
calcPREN(getSteel("10Х17Н13М2Т")!); // ~25.25 — стойкость к питтингу (Cr + 3.3·Mo)
calcCEV(getSteel("09Г2С")!);         // ~0.36 — углеродный эквивалент (свариваемость)
```

## CLI

Использование из терминала без JS-проекта:

```bash
npx steel-lib compare 40Х 45Х          # 40Х vs 45Х → 85% похожи
npx steel-lib similar Ст3 -n 5          # 5 ближайших аналогов
npx steel-lib explain Сталь\ 20 Сталь\ 45   # разбор по факторам (--en для англ.)
npx steel-lib info 10Х17Н13М2Т          # карточка марки: состав, механика, PREN/CEV
npx steel-lib find --has Cr,Ni --min-tensile 900   # подбор по критериям
```

Флаги `find`: `--category`, `--has <Cr,Ni>`, `--min-tensile` / `--max-tensile`, `--min-carbon` / `--max-carbon`. Полный список — `steel-lib --help`.

## Сценарии использования

- **Замена дефицитной марки** — найти эквивалент, когда оригинал недоступен
- **Подбор материала** — отфильтровать марки под требуемые характеристики
- **Поиск зарубежного аналога** — посмотреть AISI / DIN-EN / JIS для ГОСТ-марки

## API

### Поиск

| Функция | Описание |
|---|---|
| `getSteel(name: string)` | Найти марку по точному имени (`"Ст3"`, `"40Х"`, `"12Х18Н10Т"`) |
| `getSteelById(id: string)` | Найти марку по id (`"gost-st3"`, `"gost-40x"`) |
| `getSteelByStandard(code: string)` | Найти ГОСТ-марку по коду AISI/DIN-EN/JIS (`"304"`, `"D2"`, `"1.4541"`, `"SUS321"`) |
| `steels: Steel[]` | Все марки в базе |

### Сравнение

| Функция | Описание |
|---|---|
| `compareSteel(aName, bName)` | Сравнить две марки по имени. `null` если хотя бы одна не найдена |
| `calculateSimilarity(a, b)` | Сравнить два объекта `Steel` напрямую |
| `compareChem(a, b)` | Сравнить только химию (взвешенно по элементам) |
| `compareRange(a, b)` | Сравнить два `{min, max}` диапазона. Возвращает `[0..1]` |
| `findSimilar(name)` | Все марки, отсортированные по убыванию похожести. Сама марка исключена |
| `explainSimilarity(aName, bName, opts?)` | Текстовый разбор похожести двух марок. `opts.lang: "ru" \| "en"`. Возвращает `{ summary, factors }` или `null` |

### Подбор

| Функция | Описание |
|---|---|
| `findBy(filter)` | Все `Steel`, удовлетворяющие фильтру (семантика AND). Пустой фильтр — все марки |
| `matchesFilter(steel, filter)` | Предикат на одну марку, лежащий в основе `findBy` |

Поля фильтра (все опциональны): `category` (массив = OR), `min/maxTensile`, `min/maxYield`, `min/maxElongation`, `min/maxHardnessHrc`, `min/maxHardnessHb`, `min/maxCarbon`, `hasElement` (массив = AND), `minElement` / `maxElement` (`{ Cr: 0.8 }`). `min*` сверяет гарантированную нижнюю границу марки, `max*` — верхнюю.

### Индексы по составу

| Функция | Описание |
|---|---|
| `calcPREN(steel)` | Стойкость к питтингу: `Cr + 3.3·Mo + 16·N` (N=0 — нет в базе) |
| `calcCEV(steel)` | Углеродный эквивалент, IIW: `C + Mn/6 + (Cr+Mo+V)/5 + (Cu+Ni)/15` (свариваемость) |

Оба берут номинальное (среднее) содержание из диапазонов `{min, max}`.

## Модель данных

```ts
type Steel = {
    id: string;                    // "gost-st3", "gost-40x"
    name: string;                  // "Ст3", "40Х"
    category: SteelCategory;       // "конструкционная углеродистая" и т.д.
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

## Алгоритм

Гибридная similarity-метрика для диапазонов:

- **Overlap score** (вес `0.7`) — IoU-подобная мера для `{min, max}` диапазонов
- **Center score** (вес `0.3`) — близость средних значений

Итоговая похожесть — взвешенное среднее по химическим элементам + предел текучести. Веса элементов основаны на металлургической значимости:

- ASM Handbook Vol. 1 — иерархия влияния легирующих элементов
- IIW Carbon Equivalent (`CEV = C + Mn/6 + (Cu+Ni)/15 + (Cr+Mo+V)/5`)
- PREN (`Cr + 3.3·Mo + 16·N`) — стойкость к питтинговой коррозии

Полная таблица весов и обоснования — в [`src/similarity.ts`](./src/similarity.ts).

## Покрытие БД

v0.3.0 включает **72 марки ГОСТ** по категориям:

- **Конструкционные углеродистые** — Ст3, Ст5, Сталь 10–60
- **Конструкционные легированные** — 20Х, 40Х, 30ХГСА, 40ХН, 12ХН3А, 40ХН2МА, 38Х2МЮА и т.д.
- **Жаро-/теплоустойчивые** — 15Х5М, 12Х1МФ, 15ХМ, 12МХ
- **Свариваемые низколегированные** — 09Г2С, 10Г2С1, 16ГС, 17ГС, 15ХСНД
- **Рессорно-пружинные** — 65Г, 60С2А, 50ХФА, 70С3А
- **Подшипниковые** — ШХ15, ШХ15СГ
- **Инструментальные углеродистые** — У7, У8, У9, У10, У12
- **Инструментальные легированные** — ХВГ, 5ХНМ, 4Х5МФС, Х12, Х12МФ, Х12Ф1, 9ХС
- **Быстрорежущие** — Р6М5, Р18, Р6М5К5
- **Коррозионностойкие / аустенитные** — 08Х18Н10, 12Х18Н10Т, 12Х18Н9, 12Х13, 20Х13, 40Х13, 10Х17Н13М2Т, 10Х11Н20Т3Р, 20Х23Н18

Зарубежные стандарты (AISI / DIN-EN / JIS) присутствуют как cross-reference поля у каждой марки.

> Химические составы — по ГОСТ; механические/физические свойства представительные (зависят от сечения и термообработки).

## Roadmap

- **v0.2.0** ✅ — поиск по AISI/DIN/JIS (`getSteelByStandard`), `explainSimilarity()`, тесты
- **v0.3.0** ✅ — фильтр-движок `findBy()`, +12 марок, `calcPREN()` / `calcCEV()`
- **v0.4+** — CLI (`npx steel-lib compare <a> <b>`), полный JSDoc, англоязычные описания марок
- **v1.0.0** — заморозка API, сайт документации

## Лицензия

MIT — см. [LICENSE](./LICENSE).
