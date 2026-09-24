/**
 * 配布するプラグインの中身を調べ、「セキュリティについて」ページ
 * （src/lib/security.js）に書いたことが本当に正しいかを確かめる。
 *
 * ────────────────────────────────────────────────────────
 * 【いつ使うか】
 *
 * プラグインを追加・更新して、zip を管理画面に上げる前。
 * ページには「外部と通信しない」「CDNから読み込まない」と書いてあるので、
 * それを破るコードが紛れ込んでいないかをここで見つける。
 *
 * ────────────────────────────────────────────────────────
 * 【使い方】（このリポジトリのフォルダで実行）
 *
 *   node scripts/check-plugin-security.mjs "C:\Users\…\Desktop\kintonePlugin"
 *
 * 指定したフォルダの中の .zip（配布するプラグイン）をすべて開いて調べ、
 * 結果を plugin-security-report.md に書き出します（Git には入りません）。
 * zip が1つも無いときは、フォルダ内の .js / .html をそのまま調べます。
 * zip を1つだけ指定することもできます。
 *
 * ────────────────────────────────────────────────────────
 * 【結果の読み方】
 *
 * ✖ 要対応 … ページの記載と食い違う可能性が高いもの。公開前に必ず確認する。
 *   - manifest.json で外部URLのJS/CSSを読み込んでいる（CDN）
 *   - zip の中に秘密鍵（.ppk など）が入っている
 * ⚠ 要確認 … 通信や危険な書き方の「候補」。問題ないことも多い。
 *   - fetch / XMLHttpRequest / kintone.proxy / sendBeacon / WebSocket
 *   - コードに書かれた外部のURL
 *   - innerHTML など（レコードの値をそのまま入れていると XSS の原因になる）
 *   - eval / new Function
 *
 * 同梱しているライブラリ（ExcelJS・jsPDF など）の中にも fetch や URL は
 * たくさん出てきます。ライブラリの中にあるだけなら、呼ばれない限り通信しません。
 * 見るべきは「自分で書いたファイル」に出ているかどうかです。
 *
 * 機械的な文字列検索なので、これで「安全」と証明できるわけではありません。
 * 最後はブラウザの開発者ツール（Network タブ）で実際の通信を見て確かめてください。
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { resolve, join, extname, basename, relative } from 'node:path'
import { unzipSync, strFromU8 } from 'fflate'

const REPORT_FILE = resolve('plugin-security-report.md')

/** 調べるファイルの種類 */
const TEXT_EXTS = new Set(['.js', '.mjs', '.cjs', '.html', '.htm', '.css', '.json'])

/** 探さないフォルダ */
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist-test', '.cache'])

/** 入っていてはいけないファイル（署名用の秘密鍵など） */
const SECRET_EXTS = new Set(['.ppk', '.pem', '.key'])

/**
 * 外部URLのうち、通信ではなく「名前」として書かれているだけのもの。
 * Excel・SVG などの形式が決まりとして持っている文字列や、
 * ライブラリのライセンス表記に出てくるアドレスなので、報告から外す。
 */
const HARMLESS_HOSTS = [
  'www.w3.org',
  'w3.org',
  'schemas.openxmlformats.org',
  'schemas.microsoft.com',
  'purl.org',
  'ns.adobe.com',
  'www.apache.org',
  'opensource.org',
  'github.com',
  'raw.githubusercontent.com',
  'developer.mozilla.org',
  'fb.me',
  'reactjs.org',
  'react.dev',
  'mths.be',
  'feross.org',
  'npmjs.com',
  'www.npmjs.com',
  'mozilla.org',
  'tools.ietf.org',
  'datatracker.ietf.org',
  'www.ecma-international.org',
  'tc39.es',
  'localhost',
  'example.com',
  'www.example.com',
]

/** kintone 自身（お客さまの環境）への通信は問題ない */
function isKintoneHost(host) {
  return /(^|\.)(cybozu\.com|cybozu\.cn|kintone\.com|cybozu-dev\.com)$/.test(host)
}

/** 通信の入り口になるもの */
const NETWORK_PATTERNS = [
  { label: 'fetch()', re: /\bfetch\s*\(/g },
  { label: 'XMLHttpRequest', re: /\bXMLHttpRequest\b/g },
  { label: 'kintone.proxy', re: /\bkintone\.proxy\b/g },
  { label: 'navigator.sendBeacon', re: /\bsendBeacon\s*\(/g },
  { label: 'WebSocket', re: /\bnew\s+WebSocket\b/g },
  { label: 'EventSource', re: /\bnew\s+EventSource\b/g },
  { label: 'importScripts', re: /\bimportScripts\s*\(/g },
  { label: '<script src=外部>', re: /<script[^>]+src\s*=\s*["']https?:\/\//gi },
  { label: 'script.src=外部', re: /\.src\s*=\s*["'`]https?:\/\//g },
]

/** 書き方しだいで XSS になるもの */
const HTML_PATTERNS = [
  { label: 'innerHTML', re: /\.innerHTML\s*\+?=/g },
  { label: 'outerHTML', re: /\.outerHTML\s*\+?=/g },
  { label: 'insertAdjacentHTML', re: /\binsertAdjacentHTML\s*\(/g },
  { label: 'document.write', re: /\bdocument\.write(ln)?\s*\(/g },
  { label: 'jQuery .html()', re: /\.html\s*\(\s*[^)\s]/g },
]

const EVAL_PATTERNS = [
  { label: 'eval()', re: /(^|[^.\w$])eval\s*\(/g },
  { label: 'new Function()', re: /\bnew\s+Function\s*\(/g },
]

const URL_RE = /https?:\/\/([a-z0-9.-]+\.[a-z]{2,}|localhost)(:\d+)?[^\s'"`)<>\\]*/gi

// ───────────────────────────────────────────────────────

const target = process.argv[2]
if (!target) {
  console.error('使い方: node scripts/check-plugin-security.mjs <プラグインのフォルダ または zip>')
  process.exit(1)
}
const root = resolve(target)
if (!existsSync(root)) {
  console.error(`見つかりません: ${root}`)
  process.exit(1)
}

const units = collectUnits(root)
if (units.length === 0) {
  console.error('調べるファイルが見つかりませんでした（.zip / .js / .html）。')
  process.exit(1)
}

const results = units.map(inspectUnit)
writeFileSync(REPORT_FILE, buildReport(results), 'utf8')

// 画面には要約だけ出す
let errorCount = 0
let warnCount = 0
for (const r of results) {
  const errors = r.findings.filter((f) => f.level === 'error').length
  const warns = r.findings.filter((f) => f.level === 'warn').length
  errorCount += errors
  warnCount += warns
  const mark = errors ? '✖' : warns ? '⚠' : '✔'
  console.log(`${mark} ${r.name}  （要対応 ${errors} ／ 要確認 ${warns}）`)
}
console.log('')
console.log(`${results.length} 件を調べました。要対応 ${errorCount} ／ 要確認 ${warnCount}`)
console.log(`詳しい結果: ${REPORT_FILE}`)
process.exit(errorCount ? 1 : 0)

// ───────────────────────────────────────────────────────

/**
 * 調べる単位（プラグイン1本ぶん）を集める。
 * zip があれば zip ごと。無ければフォルダ全体を1単位にする。
 */
function collectUnits(path) {
  if (statSync(path).isFile()) {
    if (extname(path).toLowerCase() === '.zip') return [zipUnit(path)]
    return [{ name: basename(path), files: [{ path: basename(path), data: readFileSync(path) }] }]
  }

  const all = walk(path)
  const zips = all.filter((p) => extname(p).toLowerCase() === '.zip')
  if (zips.length > 0) return zips.map(zipUnit)

  // zip が無い（ソースだけ）のとき
  const files = all
    .filter((p) => TEXT_EXTS.has(extname(p).toLowerCase()) || SECRET_EXTS.has(extname(p).toLowerCase()))
    .map((p) => ({ path: relative(path, p), data: readFileSync(p) }))
  return [{ name: basename(path), files, isSource: true }]
}

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...walk(join(dir, entry.name)))
    } else {
      out.push(join(dir, entry.name))
    }
  }
  return out
}

/**
 * kintone のプラグイン zip は二重構造（外側 zip の中に contents.zip）。
 * 外側に manifest.json がある「署名前の zip」にも対応する。
 */
function zipUnit(zipPath) {
  const name = relative(root, zipPath) || basename(zipPath)
  let outer
  try {
    outer = unzipSync(new Uint8Array(readFileSync(zipPath)))
  } catch (error) {
    return { name, files: [], openError: `zip を開けませんでした（${error.message}）` }
  }

  const files = []
  for (const [path, data] of Object.entries(outer)) {
    if (path === 'contents.zip') continue
    files.push({ path, data })
  }

  if (outer['contents.zip']) {
    try {
      const inner = unzipSync(outer['contents.zip'])
      for (const [path, data] of Object.entries(inner)) {
        files.push({ path: `contents.zip/${path}`, data })
      }
    } catch (error) {
      return { name, files, openError: `contents.zip を開けませんでした（${error.message}）` }
    }
  }
  return { name, files }
}

/** 1本ぶんを調べて、見つかったものを返す */
function inspectUnit(unit) {
  const findings = []
  if (unit.openError) findings.push({ level: 'error', label: unit.openError, file: '' })

  for (const file of unit.files) {
    const ext = extname(file.path).toLowerCase()

    if (SECRET_EXTS.has(ext)) {
      findings.push({
        level: 'error',
        label: '秘密鍵らしきファイルが入っています。配布物に含めてはいけません',
        file: file.path,
      })
      continue
    }
    if (!TEXT_EXTS.has(ext)) continue

    const text = strFromU8(file.data)

    if (basename(file.path) === 'manifest.json') {
      findings.push(...inspectManifest(file.path, text))
      continue
    }
    if (ext === '.css') {
      findings.push(...inspectUrls(file.path, text))
      continue
    }
    if (ext === '.json') continue

    for (const pattern of NETWORK_PATTERNS) {
      findings.push(...matchAll(file.path, text, pattern, 'warn', '通信'))
    }
    for (const pattern of HTML_PATTERNS) {
      findings.push(...matchAll(file.path, text, pattern, 'warn', 'HTML挿入'))
    }
    for (const pattern of EVAL_PATTERNS) {
      findings.push(...matchAll(file.path, text, pattern, 'warn', 'eval'))
    }
    findings.push(...inspectUrls(file.path, text))
  }

  return { ...unit, findings }
}

/** manifest.json の js / css に外部URLがあれば CDN 読み込み */
function inspectManifest(path, text) {
  let manifest
  try {
    manifest = JSON.parse(text)
  } catch {
    return [{ level: 'error', label: 'manifest.json を読めませんでした', file: path }]
  }
  const found = []
  for (const area of ['desktop', 'mobile', 'config']) {
    for (const kind of ['js', 'css']) {
      for (const entry of manifest[area]?.[kind] ?? []) {
        if (/^https?:\/\//i.test(entry)) {
          found.push({
            level: 'error',
            label: `外部から読み込んでいます（${area}.${kind}）。ページには「CDNから読み込まない」と書いています`,
            file: path,
            snippet: entry,
          })
        }
      }
    }
  }
  return found
}

/** コードに書かれた外部のURLを、アドレス（ホスト）ごとにまとめて報告する */
function inspectUrls(path, text) {
  const hosts = new Map()
  for (const match of text.matchAll(URL_RE)) {
    const host = match[1].toLowerCase()
    if (HARMLESS_HOSTS.includes(host) || isKintoneHost(host)) continue
    if (!hosts.has(host)) hosts.set(host, { count: 0, sample: match[0] })
    hosts.get(host).count += 1
  }
  return [...hosts].map(([host, { count, sample }]) => ({
    level: 'warn',
    category: '外部URL',
    label: `外部URL: ${host}（${count} か所）`,
    file: path,
    snippet: sample.slice(0, 120),
  }))
}

/**
 * パターンに合った箇所を報告する。
 * 圧縮されたライブラリは1行が数万文字あるので、前後だけを切り出す。
 * 同じファイルで何百回も出るものは、件数と最初の1か所だけにする。
 */
function matchAll(path, text, { label, re }, level, category) {
  const matches = [...text.matchAll(re)]
  if (matches.length === 0) return []
  const first = matches[0]
  const start = Math.max(0, first.index - 50)
  const snippet = text
    .slice(start, first.index + first[0].length + 50)
    .replace(/\s+/g, ' ')
    .trim()
  return [
    {
      level,
      category,
      label: `${label}（${matches.length} か所）`,
      file: path,
      line: lineOf(text, first.index),
      snippet,
    },
  ]
}

function lineOf(text, index) {
  let line = 1
  for (let i = 0; i < index; i += 1) if (text.charCodeAt(i) === 10) line += 1
  return line
}

/** Markdown の表の中に入れても崩れないようにする */
function cell(value) {
  return String(value ?? '')
    .replaceAll('|', '\\|')
    .replaceAll('`', "'")
    .replace(/\s+/g, ' ')
}

function buildReport(results) {
  const lines = [
    '# プラグイン セキュリティチェック結果',
    '',
    `実行日時: ${new Date().toLocaleString('ja-JP')}`,
    `対象: ${root}`,
    '',
    '- ✖ 要対応 … 「セキュリティについて」ページの記載と食い違う可能性が高いもの。公開前に必ず直す。',
    '- ⚠ 要確認 … 通信や危険な書き方の候補。自分で書いたファイルに出ていれば中身を確認する。',
    '  同梱ライブラリ（exceljs.min.js など）の中に出ているだけなら、通常は問題ありません。',
    '',
    '## 一覧',
    '',
    '| | プラグイン | 要対応 | 要確認 |',
    '| --- | --- | --- | --- |',
  ]

  for (const r of results) {
    const errors = r.findings.filter((f) => f.level === 'error').length
    const warns = r.findings.filter((f) => f.level === 'warn').length
    const mark = errors ? '✖' : warns ? '⚠' : '✔'
    lines.push(`| ${mark} | ${cell(r.name)} | ${errors} | ${warns} |`)
  }

  for (const r of results) {
    lines.push('', `## ${r.name}`, '')
    const files = r.files.filter((f) => TEXT_EXTS.has(extname(f.path).toLowerCase()))
    lines.push(`調べたファイル: ${files.map((f) => `\`${f.path}\``).join('、') || 'なし'}`, '')

    if (r.findings.length === 0) {
      lines.push('✔ 気になる箇所は見つかりませんでした。')
      continue
    }

    lines.push('| | 内容 | ファイル | 行 | 該当箇所（最初の1か所） |', '| --- | --- | --- | --- | --- |')
    const sorted = [...r.findings].sort((a, b) =>
      a.level === b.level ? 0 : a.level === 'error' ? -1 : 1,
    )
    for (const f of sorted) {
      lines.push(
        `| ${f.level === 'error' ? '✖' : '⚠'} | ${cell(f.label)} | ${cell(f.file)} | ${
          f.line ?? ''
        } | ${f.snippet ? `\`${cell(f.snippet)}\`` : ''} |`,
      )
    }
  }

  lines.push('')
  return lines.join('\n')
}
