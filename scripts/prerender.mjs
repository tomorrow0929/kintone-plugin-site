/**
 * プラグイン詳細ページを、ビルド時に静的HTMLとして書き出す。
 *
 * ────────────────────────────────────────────────────────
 * 【なぜ必要か】
 *
 * このサイトは1つの index.html で全ページを描く作り（SPA）です。
 * そのため、JavaScript を実行しないクローラーから見た /plugins/xxx は
 * 36本すべてが次の状態でした。
 *
 *   <title>   kintone 無料プラグイン一覧      ← 36本すべて同じ
 *   canonical https://plugins.to-morrow.net/  ← トップページを指している
 *   <body>    <div id="root"></div> だけ      ← 本文が無い
 *
 * canonical がトップを指していると、検索エンジンに
 * 「この36本はすべてトップページの重複です」と伝えることになります。
 * 個別のプラグイン名では検索結果に出ません。
 *
 * このスクリプトは dist/plugins/<slug>.html を書き出し、
 *   - プラグインごとの title / description / canonical / og / 構造化データ
 *   - 本文のテキスト（見出し・説明・使い方・導入手順・関連プラグイン）
 * を「最初に返されるHTML」に含めます。
 *
 * ────────────────────────────────────────────────────────
 * 【URLは変わりません】
 *
 * Amplify Hosting は拡張子なしのリクエストに対して <path>.html を返します
 * （事業サイトの /privacy が privacy.html を返しているのと同じ仕組み）。
 * そのため /plugins/xxx のまま、末尾スラッシュも付きません。
 * canonical・sitemap・サイト内リンクはすべて今のURLのままです。
 *
 * ────────────────────────────────────────────────────────
 * 【ページを開いた人から見た動き】
 *
 * 静的HTMLがすぐ表示され、そのあと React が同じ内容で描き直します。
 * 「読み込み中…」の空白を挟まないため、プラグインのデータを
 * window.__PRERENDERED_PLUGIN__ に埋め込んで React 側へ渡しています
 * （受け取り側は src/pages/PluginDetail.jsx の readPrerendered）。
 *
 * ────────────────────────────────────────────────────────
 * 【失敗しても何も壊しません】
 *
 * DBに繋がらない等で失敗したときは、何も書き出さずに終了します。
 * その場合は今までどおり SPA のフォールバックで表示されます
 * （amplify.yml 側で `|| true` にしてビルドは止めません）。
 *
 * HTMLの組み立て自体は scripts/lib/render-page.mjs にあります。
 *
 * 実行: npm run build && node scripts/prerender.mjs
 *       （まとめて: npm run build:all）
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'

import { fetchPublishedPlugins } from './lib/plugin-data.mjs'
import { buildPage, buildListPage } from './lib/render-page.mjs'
import { normalizeCategory, categorySlug, sortCategories } from '../src/lib/category.js'

const DIST = resolve('dist')
const TEMPLATE = resolve(DIST, 'index.html')

try {
  if (!existsSync(TEMPLATE)) {
    throw new Error('dist/index.html がありません（先に npm run build を実行してください）')
  }

  const template = readFileSync(TEMPLATE, 'utf8')
  const plugins = (await fetchPublishedPlugins()).map((p) => ({
    ...p,
    category: normalizeCategory(p.category),
  }))

  for (const plugin of plugins) {
    const outFile = resolve(DIST, `plugins/${plugin.slug}.html`)
    mkdirSync(dirname(outFile), { recursive: true })
    writeFileSync(outFile, buildPage(template, plugin, plugins), 'utf8')
  }

  // カテゴリページ。/category/<slug> でそのカテゴリだけを並べる。
  const categories = sortCategories([...new Set(plugins.map((p) => p.category).filter(Boolean))])
  let categoryCount = 0
  for (const category of categories) {
    const slug = categorySlug(category)
    if (!slug) {
      // src/lib/category.js の CATEGORY_META に無いカテゴリ。
      // 新しいカテゴリを増やしたら、slug も足すこと。
      console.warn(`prerender: slug が未定義のカテゴリを飛ばしました（${category}）`)
      continue
    }
    const outFile = resolve(DIST, `category/${slug}.html`)
    mkdirSync(dirname(outFile), { recursive: true })
    writeFileSync(outFile, buildListPage(template, category, plugins), 'utf8')
    categoryCount += 1
  }

  /**
   * トップページ。
   *
   * dist/index.html は「SPAのフォールバック」も兼ねているので、
   * ここを一覧の中身で上書きすると、存在しないURLでも一瞬だけ一覧が見える。
   * ただしそれらは404ステータスで返るためインデックスされず、
   * React が起動すれば「ページが見つかりません」に差し替わる。
   * 一番大事なトップページに本文が無いほうが損失が大きいので、上書きする。
   *
   * template は最初に読み込んだものを使っているので、ここで上書きしても
   * 上のループには影響しない。
   */
  writeFileSync(TEMPLATE, buildListPage(template, null, plugins), 'utf8')

  console.log(
    `静的HTMLを書き出しました（詳細 ${plugins.length} 本／カテゴリ ${categoryCount} 件／トップ 1 件）`,
  )
  console.log('確認: curl -s https://plugins.to-morrow.net/plugins/<slug> | head -c 400')
} catch (error) {
  /**
   * ここで意図的にビルドを失敗させる。
   *
   * 書き換えルールを 404 系にしたので、plugins/<slug>.html が無いと
   * /plugins/xxx は404になる。書き出しに失敗したままデプロイすると
   * 36ページが全滅するので、デプロイさせずに前の版を生かしておく。
   *
   * ビルドが赤くなったら Amplify のビルドログでこのメッセージを確認し、
   * DBに繋がる状態にしてから再デプロイする。
   */
  console.error(`prerender: 静的HTMLを書き出せませんでした（${error.message}）`)
  console.error('このままデプロイすると詳細ページ36本が404になるため、ビルドを中止します。')
  process.exit(1)
}
