/**
 * sitemap.xml を作る（ビルド後に実行）。
 *
 * 【なぜ必要か】
 * このサイトは1つの index.html で全ページを描く作りなので、
 * 検索エンジンはトップページを読んでJavaScriptを実行しないと
 * 36本の詳細ページの存在に気づけません。
 * sitemap.xml にURLを並べておくと、発見がはるかに早くなります。
 *
 * 【失敗してもビルドは止めません】
 * DBへの接続に失敗した場合でも、トップページだけを載せた
 * 最小限の sitemap.xml を書き出して正常終了します。
 * サイトが公開できなくなるほうが損害が大きいためです。
 *
 * 実行: node scripts/generate-sitemap.mjs
 * （amplify.yml のビルドコマンドから呼ばれます）
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const SITE_URL = 'https://plugins.to-morrow.net'
const OUT_DIR = resolve('dist')
const OUT_FILE = resolve(OUT_DIR, 'sitemap.xml')
const TODAY = new Date().toISOString().slice(0, 10)

/** URLの一覧から sitemap.xml の中身を組み立てる */
function buildXml(entries) {
  const body = entries
    .map(
      ({ loc, priority, changefreq }) => `  <url>
    <loc>${loc}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`
}

/** 公開中プラグインの slug を全部集める */
async function fetchSlugs() {
  const outputsPath = resolve('amplify_outputs.json')
  if (!existsSync(outputsPath)) {
    throw new Error('amplify_outputs.json が見つかりません')
  }

  const outputs = JSON.parse(readFileSync(outputsPath, 'utf8'))
  const { Amplify } = await import('aws-amplify')
  const { generateClient } = await import('aws-amplify/data')

  Amplify.configure(outputs)
  const client = generateClient({ authMode: 'identityPool' })

  const all = []
  let nextToken = null
  do {
    const result = await client.models.Plugin.list({
      filter: { published: { eq: true } },
      nextToken,
    })
    if (result.errors?.length) {
      throw new Error(result.errors.map((e) => e.message).join(' / '))
    }
    all.push(...(result.data ?? []))
    nextToken = result.nextToken ?? null
  } while (nextToken)

  return all.map((p) => p.slug).filter(Boolean)
}

function write(entries) {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(OUT_FILE, buildXml(entries), 'utf8')
}

const topPage = { loc: `${SITE_URL}/`, priority: '1.0', changefreq: 'weekly' }

try {
  const slugs = await fetchSlugs()
  write([
    topPage,
    ...slugs.map((slug) => ({
      loc: `${SITE_URL}/plugins/${slug}`,
      priority: '0.8',
      changefreq: 'monthly',
    })),
  ])
  console.log(`sitemap.xml を作成しました（${slugs.length + 1} 件）`)
} catch (error) {
  console.warn(`sitemap: プラグイン一覧を取得できませんでした（${error.message}）`)
  console.warn('トップページのみの sitemap.xml を書き出します。ビルドは続行します。')
  write([topPage])
}
