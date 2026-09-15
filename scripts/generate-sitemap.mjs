/**
 * sitemap.xml を最新の状態に更新する（ビルド後に実行）。
 *
 * 【なぜ必要か】
 * このサイトは1つの index.html で全ページを描く作りなので、
 * 検索エンジンはトップページを読んでJavaScriptを実行しないと
 * 36本の詳細ページの存在に気づけません。
 * sitemap.xml にURLを並べておくと、発見がはるかに早くなります。
 *
 * 【失敗しても何も壊しません】
 * public/sitemap.xml に手書きの一覧を置いてあり、ビルド時に dist へコピーされます。
 * このスクリプトはDBから最新の一覧を取れたときだけ、それを上書きします。
 * 取れなかった場合は「何もせずに終了」します。
 * 中途半端なサイトマップで上書きしてしまうほうが害が大きいためです。
 *
 * 実行: node scripts/generate-sitemap.mjs
 * （amplify.yml のビルドコマンドから呼ばれます）
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { fetchPublishedPlugins } from './lib/plugin-data.mjs'
import { pluginUrl } from '../src/lib/plugin-meta.js'
import { SITE_URL } from '../src/lib/site.js'

const OUT_FILE = resolve('dist', 'sitemap.xml')
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

try {
  // 1件も取れなかったときは例外になる（既存のサイトマップを消さないため）
  const plugins = await fetchPublishedPlugins()

  writeFileSync(
    OUT_FILE,
    buildXml([
      { loc: `${SITE_URL}/`, priority: '1.0', changefreq: 'weekly' },
      ...plugins.map((plugin) => ({
        // canonical と同じURLの作り方を使う（食い違うと評価が分散する）
        loc: pluginUrl(plugin.slug),
        priority: '0.8',
        changefreq: 'monthly',
      })),
    ]),
    'utf8',
  )
  console.log(`sitemap.xml を最新化しました（${plugins.length + 1} 件）`)
} catch (error) {
  console.warn(`sitemap: 最新の一覧を取得できませんでした（${error.message}）`)
  console.warn('public/sitemap.xml の内容をそのまま使います。ビルドは続行します。')
}
