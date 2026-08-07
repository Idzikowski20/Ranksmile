import fs from 'fs';
import path from 'path';

/**
 * Six inline `animation:` declarations across two panels named `editorSkeletonPulse`, a
 * keyframe that has never existed — only `skeletonPulse` is defined. CSS drops an
 * animation whose name it cannot resolve without any error, so those skeletons rendered
 * as static grey blocks and nothing said so.
 */
describe('inline animations reference keyframes that exist', () => {
  const root = process.cwd();

  const namesIn = (src: string): string[] => [...src.matchAll(/@keyframes\s+([A-Za-z0-9_-]+)/g)]
    .map(([, n]) => n);

  const sourceFiles = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) return sourceFiles(full);
      return /\.tsx?$/.test(e.name) ? [full] : [];
    });

  it('every animation name used in components/ resolves to a keyframe', () => {
    const files = sourceFiles(path.join(root, 'components'));
    const declaring = [...files, ...sourceFiles(path.join(root, 'pages'))];
    // Components are free to declare their own keyframes inline (Emotion, <style> tags),
    // so the defined set is globals.css plus everything the component tree declares.
    const defined = new Set([
      ...namesIn(fs.readFileSync(path.join(root, 'styles', 'globals.css'), 'utf8')),
      ...declaring.flatMap((f) => namesIn(fs.readFileSync(f, 'utf8'))),
    ]);
    const offenders: string[] = [];

    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      const used = [...src.matchAll(/animation:\s*'([A-Za-z][A-Za-z0-9_-]*)\s/g)]
        .map(([, name]) => name)
        // `none` and the CSS-wide keywords are not keyframe references.
        .filter((name) => !['none', 'inherit', 'initial', 'unset'].includes(name));
      for (const name of used) {
        if (!defined.has(name)) offenders.push(`${path.relative(root, file)} → ${name}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
