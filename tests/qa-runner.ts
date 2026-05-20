// QA runner — exercises the parts of the plugin that don't need the Figma host
// to run (pure logic in src/count/format.ts and src/translate/demo.ts).
// Run with `npx tsx tests/qa-runner.ts` from the repo root, or via the inline
// command used by the QA bash script in the repo.

import {
  applyRounding,
  buildPreview,
  countSelectedLines,
  displayText,
  graphemeCount,
  PreviewRow,
} from '../src/count/format';
import { demoProvider } from '../src/translate/demo';
import { RoundingMode } from '../src/types';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(id: string, expected: unknown, actual: unknown): void {
  const pass = JSON.stringify(expected) === JSON.stringify(actual);
  if (pass) {
    passed++;
    console.log(`PASS  ${id}`);
  } else {
    failed++;
    failures.push(id);
    console.log(`FAIL  ${id}`);
    console.log(`        expected: ${JSON.stringify(expected)}`);
    console.log(`        actual:   ${JSON.stringify(actual)}`);
  }
}

function row(text: string, rounding: RoundingMode = 'none', selected = true, translatedText?: string): PreviewRow {
  return {
    item: { nodeId: text, label: text, text, charCount: graphemeCount(text) },
    rounding,
    selected,
    translatedText,
  };
}

(async function main() {
  // QA-12 · grapheme counts
  check('QA-12.1 ASCII', 4, graphemeCount('Open'));
  check('QA-12.2 ZWJ family emoji', 1, graphemeCount('👨‍👩‍👧'));
  check('QA-12.3 regional indicator flag', 1, graphemeCount('🇩🇪'));
  check('QA-12.4 Arabic combining', 5, graphemeCount('مرحبا'));
  check('QA-12.5 phrase with space', 20, graphemeCount('Welcome to Tripguide'));
  check('QA-12.6 empty', 0, graphemeCount(''));

  // QA-15 · applyRounding
  check('QA-15.1 down5 23 -> 20', 20, applyRounding(23, 'down5'));
  check('QA-15.2 up5 23 -> 25', 25, applyRounding(23, 'up5'));
  check('QA-15.3 none 23 -> 23', 23, applyRounding(23, 'none'));
  check('QA-15.4 down5 25 -> 25', 25, applyRounding(25, 'down5'));
  check('QA-15.5 up5 25 -> 25', 25, applyRounding(25, 'up5'));
  check('QA-15.6 down5 4 -> 0', 0, applyRounding(4, 'down5'));
  check('QA-15.7 up5 1 -> 5', 5, applyRounding(1, 'up5'));

  // QA-13 / QA-38 · displayText
  check('QA-13.1 short pass-through', 'Hello', displayText('Hello'));
  check('QA-13.2 whitespace collapsed', 'Multi line text', displayText('Multi\nline\ttext'));
  check('QA-38.1 empty -> (empty)', '(empty)', displayText(''));
  check('QA-38.2 whitespace-only -> (empty)', '(empty)', displayText('   \n\t  '));
  // displayText truncates at 60 chars by default and appends an ellipsis. The
  // expected value below is the first 60 characters of the input plus '…'.
  check(
    'QA-13.3 long truncated with ellipsis',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed…',
    displayText('Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt')
  );

  // QA-21/22/23 · output formats
  check('QA-21 plain', 'Hello: 5 chars', buildPreview([row('Hello')], 'plain'));
  check('QA-22 markdown', '- Hello: 5 chars', buildPreview([row('Hello')], 'markdown'));
  check('QA-23 keyvalue', 'Hello: 5', buildPreview([row('Hello')], 'keyvalue'));

  // QA-25 · row selection
  check('QA-25.1 empty rows array', '', buildPreview([], 'plain'));
  check('QA-25.2 all unselected', '', buildPreview([row('Hi', 'none', false)], 'plain'));
  check(
    'QA-25.3 mixed: only selected',
    'Hi: 2 chars',
    buildPreview([row('Hi'), row('Bye', 'none', false)], 'plain')
  );
  check('QA-25.4 countSelectedLines', 2, countSelectedLines([row('a'), row('b'), row('c', 'none', false)]));

  // QA-15 + QA-37 · rounding applied in preview
  check('QA-37.1 plain with down5', 'aaa: 0 chars', buildPreview([row('aaa', 'down5')], 'plain'));
  check('QA-37.2 plain with up5', 'aaa: 5 chars', buildPreview([row('aaa', 'up5')], 'plain'));
  check('QA-37.3 plain with none', 'aaa: 3 chars', buildPreview([row('aaa', 'none')], 'plain'));

  // QA-26 · translated text + translated counts in preview
  const tr = row('Open', 'none', true, 'Offen');
  check('QA-26.1 plain translated', 'Offen: 5 chars', buildPreview([tr], 'plain'));
  check('QA-26.2 markdown translated', '- Offen: 5 chars', buildPreview([tr], 'markdown'));
  check('QA-26.3 keyvalue translated', 'Offen: 5', buildPreview([tr], 'keyvalue'));

  // QA-37 (combined) · rounding applies to translated count
  const trWelcome = row('Welcome to Tripguide', 'up5', true, 'Willkommen bei Tripguide');
  const willkommenCount = graphemeCount('Willkommen bei Tripguide');
  const rounded = applyRounding(willkommenCount, 'up5');
  check(
    'QA-37.4 up5 on translated',
    `Willkommen bei Tripguide: ${rounded} chars`,
    buildPreview([trWelcome], 'plain')
  );

  // QA-30 · German translations from demo provider
  const de = await demoProvider.translate(
    ['Open', 'Welcome to Tripguide', 'Hello, Emilia', 'Tripguide', 'HND Terminal 4'],
    'de'
  );
  const deBy = (s: string) => de.find((t) => t.source === s)?.translation;
  check('QA-30.1 de open', 'Offen', deBy('Open'));
  check('QA-30.2 de phrase', 'Willkommen bei Tripguide', deBy('Welcome to Tripguide'));
  check('QA-30.3 de hello phrase', 'Hallo, Emilia', deBy('Hello, Emilia'));

  // QA-36 · unknown / proper-noun strings pass through
  check('QA-36.1 brand passes through', 'Tripguide', deBy('Tripguide'));
  check('QA-36.2 phrase with brand kept', 'HND Terminal 4', deBy('HND Terminal 4'));

  // QA-31 · Spanish
  const es = await demoProvider.translate(
    ['Open', 'Welcome to Tripguide', 'Hello, Emilia', 'More'],
    'es'
  );
  const esBy = (s: string) => es.find((t) => t.source === s)?.translation;
  check('QA-31.1 es open', 'Abierto', esBy('Open'));
  check('QA-31.2 es phrase', 'Bienvenido a Tripguide', esBy('Welcome to Tripguide'));
  check('QA-31.3 es hello phrase', 'Hola, Emilia', esBy('Hello, Emilia'));
  check('QA-31.4 es more', 'Más', esBy('More'));

  // QA-32 · Arabic
  const ar = await demoProvider.translate(
    ['Open', 'Welcome', 'Welcome to Tripguide', 'More'],
    'ar'
  );
  const arBy = (s: string) => ar.find((t) => t.source === s)?.translation;
  check('QA-32.1 ar open', 'مفتوح', arBy('Open'));
  check('QA-32.2 ar welcome', 'مرحبا', arBy('Welcome'));
  check('QA-32.3 ar phrase', 'مرحبًا بك في Tripguide', arBy('Welcome to Tripguide'));
  check('QA-32.4 ar more', 'المزيد', arBy('More'));

  // QA-38 (in translation) · empty source still passes through (no crash)
  const empty = await demoProvider.translate([''], 'de');
  check('QA-38.3 empty source translation', '', empty[0]?.translation);

  // QA-12 (in translation) · grapheme count of translated string is correct
  const arHello = arBy('Welcome');
  check('QA-12.7 grapheme count of Arabic', 5, graphemeCount(arHello ?? ''));

  console.log(`\n--- ${passed} passed, ${failed} failed ---`);
  if (failed > 0) {
    console.log(`Failures: ${failures.join(', ')}`);
    process.exit(1);
  }
})();
