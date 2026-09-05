import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

function walkDir(dir, files) {
  const entries = readdirSync(dir)
  for (const entry of entries) {
    const full = join(dir, entry)
    try {
      const st = statSync(full)
      if (st.isDirectory()) {
        if (entry === 'node_modules' || entry === '.nuxt' || entry === '.git') continue
        walkDir(full, files)
      } else if (st.isFile() && extname(full) === '.vue') {
        files.push(full)
      }
    } catch {}
  }
}

const files = []
walkDir('app', files)
let count = 0
for (const file of files) {
  const content = readFileSync(file, 'utf8')
  const re = /class="([^"]*)"/g
  let m
  while ((m = re.exec(content)) !== null) {
    const c = m[1]
    if (
      c.includes('bg-[var(--color-bg-secondary)]') &&
      c.includes('rounded') &&
      !c.includes('border') &&
      !c.includes('hover') &&
      !c.includes('backdrop') &&
      !c.includes('shadow') &&
      !c.includes('flex') &&
      !c.includes('fixed') &&
      !c.includes('w-') &&
      !c.includes('h-') &&
      !c.includes('peer') &&
      !c.includes('overflow') &&
      !c.includes('input')
    ) {
      const lineNum = content.substring(0, m.index).split('\n').length
      console.log(file + ':' + lineNum + ' | ' + c)
      count++
    }
  }
}
console.log('\nRemaining: ' + count)
