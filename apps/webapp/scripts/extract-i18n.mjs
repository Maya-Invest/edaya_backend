import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(
	path.join(__dirname, '../../REACT_VERSION/src/i18n/LanguageContext.tsx'),
	'utf8'
);
const enMatch = src.match(/const en: Dict = (\{[\s\S]*?\n\});/);
const frMatch = src.match(/const fr: Dict = (\{[\s\S]*?\n\});/);
if (!enMatch || !frMatch) {
	console.error('parse failed');
	process.exit(1);
}
const out = `export type Lang = 'en' | 'fr';
export type Dict = Record<string, string>;
export const en: Dict = ${enMatch[1]};
export const fr: Dict = ${frMatch[1]};
export const dictionaries: Record<Lang, Dict> = { en, fr };
`;
const dest = path.join(__dirname, '../src/lib/i18n/dictionaries.ts');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, out);
console.log('written', dest);
