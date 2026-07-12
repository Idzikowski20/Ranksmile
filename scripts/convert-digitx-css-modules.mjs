import fs from 'node:fs';

const p = 'components/marketing/digitx/DigitXHomepage.tsx';
let c = fs.readFileSync(p, 'utf8');

if (!c.includes('digitx-homepage.module.css')) {
  c = c.replace(
    "import { digitxAssets }",
    "import styles from '../../../styles/digitx-homepage.module.css';\nimport { digitxAssets }",
  );
  c = c.replace(/className="([^"]+)"/g, (_m, cls) => {
    const parts = cls.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return `className={styles['${parts[0]}']}`;
    return `className={[${parts.map((part) => `styles['${part}']`).join(', ')}].filter(Boolean).join(' ')}`;
  });
  fs.writeFileSync(p, c);
  console.log('DigitXHomepage updated for CSS modules');
}
