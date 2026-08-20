import { writeFileSync } from 'fs';
// Importa os submódulos por caminho de arquivo: o index.js do pacote tem
// imports internos sem extensão (o Node recusa em ESM) e o "exports" do
// package.json não publica os subcaminhos.
const raiz = new URL(
  '../node_modules/@material/material-color-utilities/',
  import.meta.url,
).href;
const { CorePalette } = await import(`${raiz}palettes/core_palette.js`);
const { hexFromArgb, argbFromHex } = await import(`${raiz}utils/string_utils.js`);

/**
 * Gera a paleta M3 do painel a partir do Verde Enap.
 *
 *   node scripts/gerar_paleta.mjs
 *
 * A cor-semente é o Verde Enap oficial (#024248 — Pantone 3165C, RGB 2 66 72),
 * definido no brandbook da Enap como a cor que deve estar presente em todas as
 * composições. O algoritmo é o mesmo que o schematic do Angular Material usa
 * quando se informa uma cor customizada.
 *
 * O mapa `neutral` inclui os tons extras (4, 6, 12, 17, 22, 24, 87, 92, 94, 96)
 * exigidos pelos tokens de superfície do M3 — sem eles o mat.theme emite
 * light-dark() incompleto e as superfícies saem vazias.
 */
const SEMENTE = '#024248';

const TONS = [0, 10, 20, 25, 30, 35, 40, 50, 60, 70, 80, 90, 95, 98, 99, 100];
const TONS_NEUTROS = [
  0, 4, 6, 10, 12, 17, 20, 22, 24, 25, 30, 35, 40, 50, 60, 70, 80, 87, 90, 92, 94, 95, 96, 98, 99,
  100,
];

const paleta = CorePalette.of(argbFromHex(SEMENTE));

const linhas = (tonal, tons, indentacao) =>
  tons.map((t) => `${indentacao}${t}: ${hexFromArgb(tonal.tone(t))},`).join('\n');

const grupo = (nome, tonal, tons) =>
  `  ${nome}: (\n${linhas(tonal, tons, '    ')}\n  ),`;

const conteudo = `// Paleta gerada a partir do Verde Enap (${SEMENTE} — Pantone 3165C, RGB 2 66 72),
// a cor institucional definida no brandbook da Enap.
//
// NÃO EDITE À MÃO: rode \`node scripts/gerar_paleta.mjs\` para regerar.
// Gerada com o algoritmo oficial M3 (@material/material-color-utilities
// CorePalette.of), o mesmo do schematic "ng add @angular/material".
$enap-primary-palette: (
${linhas(paleta.a1, TONS, '  ')}
${grupo('secondary', paleta.a2, TONS)}
${grupo('neutral', paleta.n1, TONS_NEUTROS)}
${grupo('neutral-variant', paleta.n2, TONS)}
${grupo('error', paleta.error, TONS)}
);

$enap-tertiary-palette: (
${linhas(paleta.a3, TONS, '  ')}
${grupo('secondary', paleta.a2, TONS)}
${grupo('neutral', paleta.n1, TONS_NEUTROS)}
${grupo('neutral-variant', paleta.n2, TONS)}
${grupo('error', paleta.error, TONS)}
);
`;

writeFileSync('c:/ih/ih-enap-monitor/dashboard/src/styles/_enap-palette.scss', conteudo, 'utf-8');
console.log(`paleta gerada de ${SEMENTE}`);
console.log('  primary 40:', hexFromArgb(paleta.a1.tone(40)), '| 80:', hexFromArgb(paleta.a1.tone(80)));
console.log('  neutral 98:', hexFromArgb(paleta.n1.tone(98)), '| 6:', hexFromArgb(paleta.n1.tone(6)));
