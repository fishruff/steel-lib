#!/usr/bin/env node
/**
 * CLI-валидатор прод-БД: node scripts/validate_db.mjs
 * Выход 0 — БД валидна; 1 — есть проблемы (список в stderr).
 * Удобно для pre-commit / CI и для проверки staging перед merge.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validateDb } from "./db_rules.mjs";

const path = fileURLToPath(new URL("../src/steels_base.json", import.meta.url));
const db = JSON.parse(readFileSync(path, "utf8"));
const issues = validateDb(db);

if (issues.length) {
    console.error(`❌ Найдено проблем: ${issues.length}`);
    for (const i of issues) console.error("  - " + i);
    process.exit(1);
}
console.log(`✓ БД валидна: ${db.steels.length} марок, нарушений нет`);
