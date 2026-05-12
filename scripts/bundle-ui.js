// Inlines dist/ui.js and src/ui.css into src/ui.html, writes dist/ui.html.
// Figma plugin UI must be a single self-contained HTML file.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'src', 'ui.html');
const cssPath = path.join(root, 'src', 'ui.css');
const jsPath = path.join(root, 'dist', 'ui.js');
const outPath = path.join(root, 'dist', 'ui.html');

const html = fs.readFileSync(htmlPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');
const js = fs.readFileSync(jsPath, 'utf8');

const withCss = html.replace(
  '<!-- INJECT_CSS -->',
  `<style>${css}</style>`
);
const withJs = withCss.replace(
  '<!-- INJECT_JS -->',
  `<script>${js}</script>`
);

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, withJs);
console.log('Wrote', outPath);
