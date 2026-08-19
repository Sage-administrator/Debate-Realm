import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

function walkDir(dir, files) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = join(dir, entry);
    try {
      const st = statSync(full);
      if (st.isDirectory()) {
        if (entry === 'node_modules' || entry === '.nuxt' || entry === '.git') continue;
        walkDir(full, files);
      } else if (st.isFile() && extname(full) === '.vue') {
        files.push(full);
      }
    } catch {}
  }
}

const files = [];
walkDir('app', files);

const pattern = /class\s*=\s*"([^"]*bg-\[var\(--color-bg-secondary\)\][^"]*rounded[^"]*[pms][by -][^"]*)"/gi;

let results = [];

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  let match;
  while ((match = pattern.exec(content)) !== null) {
    const classes = match[1];
    const lineNum = content.substring(0, match.index).split('\n').length;
    // Only match blocks that DON'T have: border, hover, backdrop, shadow, fixed, w-*, h-*, absolute, peer-
    if (!/\bborder\b/.test(classes) && !/\bhover\b/.test(classes) && !/\bbackdrop\b/.test(classes) && !/\bshadow\b/.test(classes) && !/\bfixed\b/.test(classes) && !/\bw-\d/.test(classes) && !/\bh-\d/.test(classes) && !/\babsolute\b/.test(classes) && !/\bpeer-\b/.test(classes) && !/\bflex\b/.test(classes) && !/\boverflow\b/.test(classes)) {
      results.push({ file, line: lineNum, classes: classes.trim() });
    }
  }
}

for (const r of results) {
  console.log(r.file + ':' + r.line + '  |  ' + r.classes);
}
console.log('\nTotal: ' + results.length);
