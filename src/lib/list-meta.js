/**
 * 一覧ページ（トップ）とカテゴリページの「検索エンジンに見せる情報」。
 *
 * plugin-meta.js と同じ考え方で、画面を描く React（PluginList.jsx）と
 * ビルド時に静的HTMLを作るスクリプト（scripts/lib/render-page.mjs）の
 * 両方がこのファイルを読みます。片方だけ直すと、最初のHTMLと
 * JavaScript実行後の内容が食い違います。
 *
 * React を import していないので、Node からもそのまま読み込めます。
 */
import { SITE_URL, SITE_NAME, BUSINESS_SITE, PUBLISHER_NAME } from './site.js'
import { categoryPath, categoryLead } from './category.js'

/** 一覧ページのパス。category が無ければトップ */
export function listPath(category) {
  return category ? categoryPath(category) : '/'
}

/** 一覧ページの絶対URL */
export function listUrl(category) {
  return `${SITE_URL}${listPath(category)}`
}

/**
 * 検索結果に出るタイトル。
 * 本数を入れているのは、同種のサイトと並んだときに数で選ばれるため。
 */
export function listPageTitle(category, count) {
  if (category) {
    return `kintone ${category}の無料プラグイン${count ? ` ${count}本` : ''}｜すべて無料 | to.Morrow`
  }
  return count
    ? `kintone 無料プラグイン ${count}本｜すべて無料・登録不要 | to.Morrow`
    : 'kintone 無料プラグイン一覧 | to.Morrow'
}

/**
 * 検索結果に出る説明文。
 * カテゴリページでは、そのカテゴリに実際に入っているプラグイン名を並べる。
 * 「kintone ガントチャート 無料」のような個別機能の検索に当たるようにするため。
 */
export function listPageDescription(category, plugins) {
  if (category) {
    const names = plugins
      .map((p) => p.name.replace(/プラグイン$/, ''))
      .slice(0, 6)
      .join('・')
    return `${categoryLead(category)}${names ? `${names}など${plugins.length}本を掲載しています。` : ''}すべて無料・会員登録不要、利用期限や出力枚数の制限もありません。`
  }
  return '帳票出力・Excel出力・ガントチャート・一括更新など、業務で使える kintone プラグインをすべて無料で配布しています。会員登録不要、利用期限・出力枚数の制限もありません。'
}

/**
 * 構造化データ。
 *
 * CollectionPage + ItemList … 「何本まとまっているページか」を伝える
 * BreadcrumbList            … カテゴリページの位置を伝える（トップには付けない）
 *
 * 画面に出ていないプラグインを ItemList に入れてはいけません。
 * 実際に並んでいるものだけを渡してください。
 */
export function listPageJsonLd(category, plugins) {
  if (plugins.length === 0) return null

  const url = listUrl(category)
  const name = category ? `kintone ${category}の無料プラグイン` : 'kintone 無料プラグイン一覧'

  const collection = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description: category
      ? categoryLead(category)
      : `to.Morrow が開発した kintone プラグイン ${plugins.length} 本を、すべて無料で配布しています。`,
    url,
    inLanguage: 'ja',
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      publisher: { '@type': 'Organization', name: PUBLISHER_NAME, url: BUSINESS_SITE },
    },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: plugins.length,
      itemListElement: plugins.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: p.name,
        url: `${SITE_URL}/plugins/${p.slug}`,
      })),
    },
  }

  if (!category) return [collection]

  return [
    collection,
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'kintone 無料プラグイン一覧',
          item: `${SITE_URL}/`,
        },
        { '@type': 'ListItem', position: 2, name: category, item: url },
      ],
    },
  ]
}
