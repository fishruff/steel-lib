# Changelog

Все значимые изменения проекта документируются здесь.
Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/),
проект придерживается [семантического версионирования](https://semver.org/lang/ru/).

## [0.5.0] — 2026-06-20

### Added

- Схема `chemical_composition` расширена элементами `B` (бор) и `N` (азот); `calcPREN` теперь учитывает `N` (`+16·N`). Бор заполнен для `10Х11Н20Т3Р`.
- Валидатор БД: `scripts/db_rules.mjs` (единые правила) + `npm run validate` (CLI) + тесты `tests/data.test.ts` — структура, диапазоны (0≤min≤max, % и механика в норме), уникальность, σт≤σв.
- Прототип-парсер `scripts/parse_splav.mjs` (splav-kharkov → staging + валидация + diff vs БД) — инструмент для сверки, не публикуется.

## [0.4.0] — 2026-06-18

### Added

- CLI (`npx steel-lib`): команды `compare`, `explain`, `similar`, `info`, `find`, плюс `--help` / `--version`. Bin-entry `steel-lib`.

### Changed

- В devDependencies добавлен `@types/node` (нужен для CLI); в `tsconfig` — `types: ["node"]`.

## [0.3.0] — 2026-06-16

### Added

- `findBy(filter)` — движок подбора марок под ТЗ (семантика AND); `matchesFilter(steel, filter)` — предикат на одну марку. Поля: `category`, `min/maxTensile`, `min/maxYield`, `min/maxElongation`, `min/maxHardnessHrc`, `min/maxHardnessHb`, `min/maxCarbon`, `hasElement`, `minElement`/`maxElement`.
- `calcPREN(steel)` — стойкость к питтинговой коррозии (`Cr + 3.3·Mo + 16·N`).
- `calcCEV(steel)` — углеродный эквивалент IIW (`C + Mn/6 + (Cr+Mo+V)/5 + (Cu+Ni)/15`), свариваемость.
- 12 новых марок (60 → 72): жаро-/теплоустойчивые (15Х5М, 12Х1МФ, 15ХМ, 12МХ), свариваемые низколегированные (09Г2С, 10Г2С1, 16ГС, 17ГС, 15ХСНД), аустенитные (12Х18Н9, 10Х11Н20Т3Р, 20Х23Н18). Химсостав и механические свойства выверены по марочникам ГОСТ (20072, 19281, 5632).

## [0.2.0] — 2026-06-16

### Added

- `getSteelByStandard(code)` — поиск ГОСТ-марки по коду AISI / DIN-EN / JIS (`"304"` → 08Х18Н10).
- `explainSimilarity(a, b, { lang })` — текстовый разбор похожести двух марок (`{ summary, factors }`), языки `ru` / `en`.
- Набор тестов на vitest.

### Fixed

- `compareChem`: элементы с диапазоном `{null, null}` пропускаются (фикс: сравнение марки самой с собой = 1).
- Сборка: `tsconfig` больше не компилирует `tests/` в состав пакета (раньше `tsc` завершался с кодом 2, ломая `prepublishOnly`).

## [0.1.0] — 2026-05-24

### Added

- Первый релиз: 60 марок ГОСТ, гибридный движок похожести (`compareSteel`, `findSimilar`, `calculateSimilarity`, `compareChem`, `compareRange`), доступ к данным (`getSteel`, `getSteelById`, `steels`).
