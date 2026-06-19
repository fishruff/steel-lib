#!/usr/bin/env node
/**
 * ПРОТОТИП-ПАРСЕР splav-kharkov.com → формат Steel (staging).
 *
 * Назначение: вытащить химсостав и механику марки с марочника, разложить в наш
 * формат, провалидировать и (если марка уже есть в БД) показать diff. Результат
 * пишется в scripts/staging.json — НЕ в прод-БД. Дальше — ручной review.
 *
 * Использование:
 *   node scripts/parse_splav.mjs <name_id> [<name_id> ...]
 *   напр.: node scripts/parse_splav.mjs 2 334     (15ХМ, 15Х5М)
 *
 * ⚠️ Юридически: splav-kharkov.com — стороннее издание (Copyright). Это
 * инструмент для сверки/чернового заполнения, а не для массового копирования БД.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validateDb } from "./db_rules.mjs";

const BASE = "http://www.splav-kharkov.com/mat_start.php?name_id=";

// Элементы, которые есть в нашей схеме chemical_composition.
const SCHEMA_ELEMENTS = new Set([
    "C", "Cr", "Mo", "V", "Mn", "Si", "Ni", "P", "S", "Cu", "Ti", "W", "Co", "Al", "As", "B", "N",
]);
const BASE_ELEMENTS = ["C", "Cr", "Mo", "V", "Mn", "Si", "Ni", "P", "S", "Cu"];

const num = (s) => parseFloat(String(s).replace(",", ".").replace(/\s/g, ""));

/** "0.11 - 0.18" → {min,max}; "до 0.3" → {min:null,max}; "0.2" → {min,max:0.2}. */
function parseRange(raw) {
    const t = raw.replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    if (!t || t === "-") return null;
    let m = t.match(/^до\s*([\d.,]+)/i);
    if (m) return { min: null, max: num(m[1]) };
    m = t.match(/([\d.,]+)\s*-\s*([\d.,]+)/);
    if (m) return { min: num(m[1]), max: num(m[2]) };
    m = t.match(/^([\d.,]+)$/);
    if (m) return { min: num(m[1]), max: num(m[1]) };
    return null;
}

/** Текстовые ячейки <td>/<th> из куска HTML (теги вычищены). */
function cells(segment) {
    return [...segment.matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/gs)]
        .map((m) => m[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim())
        .filter((c) => c !== "");
}

function extractName(html) {
    // Из meta-описания: "химический состав 15ХМ, свойства 15ХМ, ...".
    const m = html.match(/химический состав\s+([^\s,<]+)/i);
    return m ? m[1].trim() : null;
}

function parseChem(html) {
    const i = html.indexOf("Химический состав в");
    if (i < 0) return { chem: {}, warns: ["нет таблицы химсостава"] };
    const cs = cells(html.slice(i, i + 2500));
    // Заголовки-символы идут подряд, пока похожи на элемент (Fe, N и т.п. тоже).
    const headers = [];
    for (const c of cs) {
        if (/^[A-Z][a-z]?$/.test(c)) headers.push(c);
        else break;
    }
    const values = cs.slice(headers.length, headers.length * 2);
    const chem = {};
    const warns = [];
    headers.forEach((el, k) => {
        const range = parseRange(values[k] ?? "");
        if (!range) return;
        if (SCHEMA_ELEMENTS.has(el)) chem[el] = range;
        else if (el !== "Fe") warns.push(`элемент ${el} не в схеме (${values[k]})`);
    });
    // Гарантируем 10 базовых ключей.
    for (const el of BASE_ELEMENTS) if (!chem[el]) chem[el] = { min: null, max: null };
    return { chem, warns };
}

function parseMech(html) {
    const i = html.indexOf("Механические свойства при");
    if (i < 0) return { mech: null, warns: ["нет таблицы механики"], row: null };
    const cs = cells(html.slice(i, i + 3000));
    // Колонки: Сортамент,Размер,Напр.,sв,sT,d5,y,KCU,Термообр. (9). После двух
    // строк-шапок (заголовки+единицы) идут данные группами по ≤9.
    const headEnd = cs.findIndex((c) => c === "Термообр.");
    const unitsEnd = headEnd + 1 + 9; // строка единиц
    const data = cs.slice(unitsEnd);
    // Разбиваем на строки: новая строка начинается с не-числового «Сортамент».
    const rows = [];
    let cur = [];
    for (const c of data) {
        const isLabel = !/^[\d.,]+$/.test(c) && !/^&Oslash;/.test(c) && !/^[\d.,]+\s*-/.test(c);
        if (isLabel && /[А-Яа-я]/.test(c) && cur.length && /^(Пруток|Трубы|Лист|Лента|Поковк|Проволок|Полоса)/i.test(c)) {
            rows.push(cur);
            cur = [];
        }
        cur.push(c);
    }
    if (cur.length) rows.push(cur);
    // Выбираем строку: предпочтительно «Пруток», где есть sв и sT.
    const numeric = (r) => r.filter((c) => /^[\d.,]+$/.test(c)).map(num);
    const candidates = rows
        .map((r) => ({ sortament: r[0], nums: numeric(r) }))
        .filter((r) => r.nums.length >= 2);
    // Предпочитаем «Пруток + ГОСТ» (нормированное состояние), затем любой Пруток.
    const pick =
        candidates.find((r) => /Пруток/i.test(r.sortament) && /ГОСТ/i.test(r.sortament)) ??
        candidates.find((r) => /Пруток/i.test(r.sortament)) ??
        candidates[0];
    const warns = [];
    if (!pick) return { mech: null, warns: ["не распознаны строки механики"], row: null };
    // nums по порядку: sв, sT, d5, [y], [KCU]
    const [sv, st, d5, , kcu] = pick.nums;
    // Sanity: σв≥σт и δ<100 — иначе разметку колонок «повело». В этом случае
    // механике доверять нельзя → обнуляем (честное «нужно вручную», а не враньё).
    const suspect =
        (Number.isFinite(sv) && Number.isFinite(st) && sv < st) ||
        (Number.isFinite(d5) && d5 >= 100);
    if (suspect) warns.push("механика: разметка колонок сбита (σв<σт или δ≥100%) — обнулена, заполнить вручную");
    // HB из строки твёрдости. Ищем по очищенному от тегов тексту ("HB 10-1 = 179").
    const plain = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
    const hbm = plain.match(/HB[\s\S]{0,12}?=\s*([\d.,]+)/i);
    const hb = hbm ? num(hbm[1]) : null;
    const ok = (v) => (!suspect && Number.isFinite(v) ? v : null);
    const mech = {
        hardness_hrc: { min: null, max: null },
        hardness_hb: { min: null, max: hb },
        tensile_strength_mpa: ok(sv),
        yield_strength_mpa: ok(st),
        elongation_percent: ok(d5),
        // KCU на сайте в кДж/м²; наш формат — Дж/см² = /10.
        impact_toughness_j_cm2: ok(kcu) === null ? null : Math.round(kcu / 10),
    };
    return { mech, warns, row: pick.sortament };
}

/**
 * Валидация staging через единые правила db_rules. Метаданные, ещё не
 * заполненные парсером (id/category/description), подставляются заглушками,
 * чтобы остались только проблемы данных (диапазоны, σт≤σв, элементы).
 */
function validate(steel) {
    const clone = structuredClone(steel);
    clone.id = clone.id || "staging-tmp";
    clone.category = clone.category || "конструкционная легированная";
    clone.description = clone.description || "(staging)";
    return validateDb({ steels: [clone] });
}

function diffRange(a, b) {
    if (!a && !b) return null;
    const eq = a && b && a.min === b.min && a.max === b.max;
    return eq ? null : `${fmt(b)} → ${fmt(a)}`;
}
const fmt = (r) => (r ? `${r.min}–${r.max}` : "—");

function diffAgainstDb(parsed, db) {
    const ex = db.steels.find((s) => s.name === parsed.name);
    if (!ex) return null;
    const lines = [];
    for (const el of Object.keys(parsed.chemical_composition)) {
        const d = diffRange(parsed.chemical_composition[el], ex.chemical_composition[el]);
        if (d) lines.push(`  ${el}: ${d}`);
    }
    for (const k of ["tensile_strength_mpa", "yield_strength_mpa", "elongation_percent", "impact_toughness_j_cm2"]) {
        if (parsed.mechanical_properties[k] !== ex.mechanical_properties[k])
            lines.push(`  ${k}: ${ex.mechanical_properties[k]} → ${parsed.mechanical_properties[k]}`);
    }
    return lines;
}

async function parseOne(nameId) {
    const url = BASE + nameId;
    const html = await (await fetch(url)).text();
    const name = extractName(html);
    const { chem, warns: cw } = parseChem(html);
    const { mech, warns: mw, row } = parseMech(html);
    return {
        steel: {
            id: null, // задать вручную: gost-<translit>
            name,
            category: null, // вручную
            standards: { aisi: null, din_en: null, gost: name, jis: null },
            chemical_composition: chem,
            mechanical_properties: mech ?? {},
            physical_properties: { density_g_cm3: null, thermal_conductivity_w_mk: null },
            description: null,
            _source: { url, mech_row: row },
        },
        warns: [...cw, ...mw],
    };
}

// ---- main ----
const ids = process.argv.slice(2);
if (!ids.length) {
    console.error("Использование: node scripts/parse_splav.mjs <name_id> [<name_id> ...]");
    process.exit(1);
}

const dbPath = fileURLToPath(new URL("../src/steels_base.json", import.meta.url));
const db = JSON.parse(readFileSync(dbPath, "utf8"));

const out = [];
for (const id of ids) {
    const { steel, warns } = await parseOne(id);
    const errs = validate(steel);
    out.push(steel);
    console.log(`\n=== name_id=${id}: ${steel.name ?? "?"} (строка механики: ${steel._source.mech_row ?? "—"}) ===`);
    console.log("  состав:", Object.entries(steel.chemical_composition)
        .filter(([, r]) => r.min !== null || r.max !== null)
        .map(([el, r]) => `${el} ${fmt(r)}`).join(", "));
    console.log("  механика:", JSON.stringify(steel.mechanical_properties));
    if (warns.length) console.log("  ⚠ warnings:", warns.join("; "));
    if (errs.length) console.log("  ❌ validation:", errs.join("; "));
    else console.log("  ✓ валидация пройдена");
    const diff = diffAgainstDb(steel, db);
    if (diff) console.log(diff.length ? "  DIFF vs БД:\n" + diff.join("\n") : "  = совпадает с БД");
}

const stagingPath = fileURLToPath(new URL("./staging.json", import.meta.url));
writeFileSync(stagingPath, JSON.stringify(out, null, 2));
console.log(`\nЗаписано в scripts/staging.json: ${out.length} марок (НЕ в прод-БД).`);
