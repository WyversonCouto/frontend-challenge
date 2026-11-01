/**
 * Auditoria Lighthouse de Início e Detalhe do NFT, em mobile e desktop, 3 medições cada.
 * Usa o build otimizado (vite preview) com o cenário padrão dos mocks. Nada é simplificado
 * para melhorar a nota: imagens, fontes e funcionalidades são os da entrega.
 *
 * Uso:  npm run lighthouse
 * Variáveis (opcionais): CHROME_PATH, LH_CHROME_FLAGS (flags separadas por espaço), LH_SKIP_BUILD=1
 */
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'
import * as chromeLauncher from 'chrome-launcher'

const root = path.resolve(import.meta.dirname, '..')
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'lighthouse/config.json'), 'utf8'))
const rawDir = path.join(root, 'lighthouse/raw')
const outDir = path.join(root, 'lighthouse/reports')
fs.mkdirSync(rawDir, { recursive: true })
fs.mkdirSync(outDir, { recursive: true })

const port = new URL(cfg.base).port
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
const pct = (n) => Math.round((n ?? 0) * 100)

// 1) build otimizado + servidor de preview
if (!process.env.LH_SKIP_BUILD) {
  const build = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit', shell: true })
  if (build.status !== 0) process.exit(build.status ?? 1)
}
const server = spawn('npx', ['vite', 'preview', '--port', port, '--strictPort'], { cwd: root, shell: true, stdio: 'ignore' })
const stop = () => {
  if (process.platform === 'win32' && server.pid) spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' })
  else server.kill()
}
process.on('exit', stop)

for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(cfg.base)).ok) break
  } catch {}
  await new Promise((r) => setTimeout(r, 500))
}

// 2) medições
const flags = (process.env.LH_CHROME_FLAGS ?? '--headless=new').split(' ').filter(Boolean)
const results = []
let chromeVersion = ''

for (const profile of cfg.profiles) {
  for (const page of cfg.pages) {
    const runs = []
    for (let n = 1; n <= cfg.runs; n++) {
      // um Chrome novo por medição: perfil limpo, sem cache e sem service worker anterior
      const chrome = await chromeLauncher.launch({ chromeFlags: flags, chromePath: process.env.CHROME_PATH })
      try {
        const options = { port: chrome.port, output: ['json', 'html'], logLevel: 'error' }
        const run = await lighthouse(cfg.base + page.path, options, profile === 'desktop' ? desktopConfig : undefined)
        const lhr = run.lhr
        chromeVersion = lhr.environment.hostUserAgent
        const file = `${page.name}-${profile}-run${n}`
        fs.writeFileSync(path.join(rawDir, `${file}.json`), run.report[0])
        fs.writeFileSync(path.join(rawDir, `${file}.html`), run.report[1])
        runs.push({
          n,
          file,
          scores: Object.fromEntries(Object.entries(lhr.categories).map(([k, v]) => [k, pct(v.score)])),
          lcp: lhr.audits['largest-contentful-paint'].numericValue,
          cls: lhr.audits['cumulative-layout-shift'].numericValue,
          tbt: lhr.audits['total-blocking-time'].numericValue,
          fcp: lhr.audits['first-contentful-paint'].numericValue,
        })
        console.log(`${page.name} ${profile} #${n}: perf ${runs.at(-1).scores.performance} a11y ${runs.at(-1).scores.accessibility} bp ${runs.at(-1).scores['best-practices']} seo ${runs.at(-1).scores.seo}`)
      } finally {
        await chrome.kill()
      }
    }
    const med = (pick) => median(runs.map(pick))
    const summary = {
      page: page.name,
      path: page.path,
      profile,
      runs,
      median: {
        performance: med((r) => r.scores.performance),
        accessibility: med((r) => r.scores.accessibility),
        'best-practices': med((r) => r.scores['best-practices']),
        seo: med((r) => r.scores.seo),
        lcp: Math.round(med((r) => r.lcp)),
        cls: Number(med((r) => r.cls).toFixed(3)),
        tbt: Math.round(med((r) => r.tbt)),
      },
    }
    // relatório entregue: a execução mediana em performance
    const byPerf = [...runs].sort((a, b) => a.scores.performance - b.scores.performance)
    const medianRun = byPerf[Math.floor(byPerf.length / 2)]
    for (const ext of ['json', 'html']) fs.copyFileSync(path.join(rawDir, `${medianRun.file}.${ext}`), path.join(outDir, `${page.name}-${profile}.${ext}`))
    results.push(summary)
  }
}
stop()

// 3) resumo reproduzível
const lhVersion = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/lighthouse/package.json'), 'utf8')).version
const env = {
  lighthouse: lhVersion,
  chrome: chromeVersion,
  node: process.version,
  os: `${os.type()} ${os.release()} (${os.arch()})`,
  cpu: `${os.cpus()[0]?.model ?? 'n/d'} x${os.cpus().length}`,
  memoryGB: Math.round(os.totalmem() / 1e9),
  date: new Date().toISOString(),
  conditions: 'Build otimizado (vite preview), cenário padrão dos mocks (MSW), Chrome novo e sem cache por medição, throttling padrão do Lighthouse (mobile: 4G simulada + CPU 4x; desktop: preset desktop).',
}
fs.writeFileSync(path.join(root, 'lighthouse/summary.json'), JSON.stringify({ env, targets: cfg.targets, results }, null, 2))

const ms = (v) => `${v} ms`
const mark = (v, t) => (v >= t ? `${v}` : `**${v}** ⚠`)
let md = `# Auditoria Lighthouse\n\nMediana de ${cfg.runs} medições por página e perfil.\n\n`
md += '| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |\n| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n'
for (const r of results) {
  const m = r.median
  md += `| ${r.page} | ${r.profile} | ${mark(m.performance, cfg.targets.performance)} | ${mark(m.accessibility, cfg.targets.accessibility)} | ${mark(m['best-practices'], cfg.targets['best-practices'])} | ${mark(m.seo, cfg.targets.seo)} | ${ms(m.lcp)} | ${m.cls} | ${ms(m.tbt)} |\n`
}
md += `\nMetas: Performance ≥ ${cfg.targets.performance}, Accessibility ≥ ${cfg.targets['best-practices']}, Best Practices ≥ ${cfg.targets['best-practices']}, SEO ≥ ${cfg.targets.seo}.\n\n## Ambiente\n\n`
for (const [k, v] of Object.entries(env)) md += `- **${k}:** ${v}\n`
md += '\n## Medições individuais (Performance)\n\n'
for (const r of results) md += `- ${r.page} / ${r.profile}: ${r.runs.map((x) => x.scores.performance).join(', ')}\n`
md += '\nRelatórios HTML/JSON da execução mediana: `lighthouse/reports/`. Todas as execuções: `lighthouse/raw/`.\n'
fs.writeFileSync(path.join(root, 'lighthouse/SUMMARY.md'), md)
console.log('\n' + md)
process.exit(0)
