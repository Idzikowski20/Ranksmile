const fs = require('fs');
const path = require('path');

const roots = ['components', 'pages', 'lib', '__tests__', 'hooks', 'services'].map((r) =>
  path.join(process.cwd(), r)
);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.next') continue;
      const norm = p.replace(/\\/g, '/');
      if (norm.includes('/components/core')) continue;
      if (norm.includes('/components/koala/core')) continue;
      if (norm.includes('/components/sentry-pages')) continue;
      walk(p, out);
    } else if (/\.(tsx?|jsx?)$/.test(ent.name)) {
      out.push(p);
    }
  }
  return out;
}

const files = roots.flatMap((r) => walk(r));
let n = 0;

for (const file of files) {
  let c = fs.readFileSync(file, 'utf8');
  const orig = c;

  c = c.replace(/from (['"])((?:\.\.\/)+)sentry-pages\1/g, 'from $1$2koala/layout$1');
  c = c.replace(/from (['"])((?:\.\.\/)+)components\/sentry-pages\1/g, 'from $1$2components/koala/layout$1');
  c = c.replace(/from (['"])@\/components\/sentry-pages\1/g, 'from $1@/components/koala/layout$1');

  c = c.replace(/from (['"])@\/components\/core\1/g, 'from $1@/components/koala/core$1');
  c = c.replace(/from (['"])@\/components\/core\//g, 'from $1@/components/koala/core/');
  c = c.replace(/from (['"])((?:\.\.\/)+)components\/core\1/g, 'from $1$2components/koala/core$1');
  c = c.replace(/from (['"])((?:\.\.\/)+)components\/core\//g, 'from $1$2components/koala/core/');

  c = c.replace(/from (['"])(\.\.\/)core\1/g, 'from $1$2koala/core$1');
  c = c.replace(/from (['"])(\.\.\/)core\//g, 'from $1$2koala/core/');
  c = c.replace(/from (['"])(\.\.\/\.\.\/)core\1/g, 'from $1$2koala/core$1');
  c = c.replace(/from (['"])(\.\.\/\.\.\/)core\//g, 'from $1$2koala/core/');
  c = c.replace(/from (['"])(\.\.\/\.\.\/\.\.\/)core\1/g, 'from $1$2koala/core$1');
  c = c.replace(/from (['"])(\.\.\/\.\.\/\.\.\/)core\//g, 'from $1$2koala/core/');
  c = c.replace(/from (['"])(\.\.\/\.\.\/\.\.\/\.\.\/)core\1/g, 'from $1$2koala/core$1');
  c = c.replace(/from (['"])(\.\.\/\.\.\/\.\.\/\.\.\/)core\//g, 'from $1$2koala/core/');

  c = c.replace(/koala\/koala\/core/g, 'koala/core');

  if (c !== orig) {
    fs.writeFileSync(file, c);
    n++;
  }
}

console.log('Updated ' + n + ' files of ' + files.length);
