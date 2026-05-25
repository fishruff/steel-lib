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
```

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
| `steels: Steel[]` | Все марки в базе |

### Сравнение

| Функция | Описание |
|---|---|
| `compareSteel(aName, bName)` | Сравнить две марки по имени. `null` если хотя бы одна не найдена |
| `calculateSimilarity(a, b)` | Сравнить два объекта `Steel` напрямую |
| `compareChem(a, b)` | Сравнить только химию (взвешенно по элементам) |
| `compareRange(a, b)` | Сравнить два `{min, max}` диапазона. Возвращает `[0..1]` |
| `findSimilar(name)` | Все марки, отсортированные по убыванию похожести. Сама марка исключена |

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

v0.1.0 включает **60 марок ГОСТ** по категориям:

- **Конструкционные углеродистые** — Ст3, Ст5, Сталь 10–60
- **Конструкционные легированные** — 20Х, 40Х, 30ХГСА, 40ХН, 12ХН3А, 40ХН2МА, 38Х2МЮА и т.д.
- **Рессорно-пружинные** — 65Г, 60С2А, 50ХФА, 70С3А
- **Подшипниковые** — ШХ15, ШХ15СГ
- **Инструментальные углеродистые** — У7, У8, У9, У10, У12
- **Инструментальные легированные** — ХВГ, 5ХНМ, 4Х5МФС, Х12, Х12МФ, Х12Ф1, 9ХС
- **Быстрорежущие** — Р6М5, Р18, Р6М5К5
- **Коррозионностойкие** — 08Х18Н10, 08Х18Н10Т, 12Х18Н10Т, 12Х13, 20Х13, 40Х13, 10Х17Н13М2Т

Зарубежные стандарты (AISI / DIN-EN / JIS) присутствуют как cross-reference поля у каждой марки. Самостоятельные не-ГОСТ записи — план v0.2.0.

## Roadmap

- **v0.2.0** — поиск по AISI/DIN/JIS, `explainSimilarity()`, тесты, расширение БД
- **v1.0.0** — стабильный API, CLI (`npx steel-lib compare <a> <b>`), полный JSDoc

## Лицензия

MIT — см. [LICENSE](./LICENSE).
