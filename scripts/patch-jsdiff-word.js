/**
 * SWC minify (Next 12 swcMinify) corrupts jsdiff's \\u{XXXX} escapes inside
 * extendedWordChars — e.g. "\\u{C0}-\\u{D6}" becomes "\\u{C0}-u{D6}" — and
 * RegExp() then throws "Range out of order in character class", crashing the
 * TipTap editor chunk. Rewrite to BMP \\uXXXX escapes which SWC leaves alone.
 */
const fs = require('fs');
const path = require('path');

const TARGETS = [
  'node_modules/diff/libesm/diff/word.js',
  'node_modules/diff/libcjs/diff/word.js',
];

// Match the SOURCE text in word.js (extra backslashes as written in the file).
const BROKEN =
  'a-zA-Z0-9_\\\\u{AD}\\\\u{C0}-\\\\u{D6}\\\\u{D8}-\\\\u{F6}\\\\u{F8}-\\\\u{2C6}\\\\u{2C8}-\\\\u{2D7}\\\\u{2DE}-\\\\u{2FF}\\\\u{1E00}-\\\\u{1EFF}';
const FIXED =
  'a-zA-Z0-9_\\\\u00AD\\\\u00C0-\\\\u00D6\\\\u00D8-\\\\u00F6\\\\u00F8-\\\\u02C6\\\\u02C8-\\\\u02D7\\\\u02DE-\\\\u02FF\\\\u1E00-\\\\u1EFF';

let patched = 0;
for (const rel of TARGETS) {
  const file = path.join(__dirname, '..', rel);
  if (!fs.existsSync(file)) {
    console.warn(`[patch-jsdiff-word] skip missing ${rel}`);
    continue;
  }
  const before = fs.readFileSync(file, 'utf8');
  if (!before.includes(BROKEN)) {
    if (before.includes(FIXED)) {
      console.log(`[patch-jsdiff-word] already patched ${rel}`);
    } else {
      console.warn(`[patch-jsdiff-word] pattern not found in ${rel}`);
    }
    continue;
  }
  fs.writeFileSync(file, before.split(BROKEN).join(FIXED));
  patched += 1;
  console.log(`[patch-jsdiff-word] patched ${rel}`);
}

if (patched === 0) {
  console.log('[patch-jsdiff-word] nothing to patch');
}
