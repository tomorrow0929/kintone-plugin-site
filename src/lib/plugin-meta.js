/**
 * プラグイン詳細ページの「検索エンジンに見せる情報」を1か所にまとめる。
 *
 * 【なぜ独立したファイルにするか】
 * 同じ内容を2か所で作る必要があるため。
 *   1. 画面を描くとき      … src/pages/PluginDetail.jsx（Reactが実行時に差し替える）
 *   2. ビルドするとき      … scripts/prerender.mjs（静的HTMLに焼き込む）
 * 片方だけ直すと「最初のHTMLと、JavaScript実行後の内容が食い違う」状態になり、
 * 検索エンジンがどちらを信じるか分からなくなります。
 * このファイルを両方から読み込むことで、食い違いが起きないようにしています。
 *
 * React を import していないので、ビルド用のスクリプト（Node）からも
 * そのまま読み込めます。ここに React のコードを書かないでください。
 */
import { SITE_URL, BUSINESS_SITE, PUBLISHER_NAME } from './site.js'
import { PLUGIN_FAQ } from './faq.js'

/** 詳細ページのパス（先頭の / から）。canonical と sitemap で共通に使う */
export function pluginPath(slug) {
  return `/plugins/${slug}`
}

/** 詳細ページの絶対URL */
export function pluginUrl(slug) {
  return `${SITE_URL}${pluginPath(slug)}`
}

/**
 * 検索結果に出るタイトル。
 * プラグイン名を先頭に置き、「無料」を明示する。
 * 36本すべてが同じタイトルだと個別のプラグイン名で拾われません。
 */
export function pluginPageTitle(plugin) {
  return `${plugin.name}（無料）| kintoneプラグイン | to.Morrow`
}

/** 検索結果に出る説明文 */
export function pluginPageDescription(plugin) {
  return `${plugin.summary ?? ''} 無料・会員登録不要でダウンロードできる kintone プラグインです。`
}

/**
 * 構造化データ（JSON-LD）。
 *
 * SoftwareApplication … 検索結果で「無料のアプリ」として認識されやすくなる
 * BreadcrumbList      … 検索結果に「一覧 > プラグイン名」の位置が出る
 * FAQPage             … ページ内の質問と回答の対応を機械的に伝える
 *
 * FAQPage について注意：2023年にGoogleがFAQのリッチリザルト（検索結果に
 * 質問が折りたたみで並ぶ表示）を、政府・医療などの一部サイトに限定しました。
 * そのため**検索結果の見た目が変わることは期待できません**。
 * それでも入れているのは、ページの内容を機械が誤解なく読めるようにするためで、
 * 本来の効果は「問い合わせが来る前に疑問が解消されること」です。
 *
 * 評価（星）は実際のレビューがないので入れません。
 * 実体のない評価を入れると Google のガイドライン違反になります。
 *
 * 必ず、画面に実際に書かれている内容と一致させてください。
 * ページに無いことを構造化データにだけ書くのは違反です。
 * FAQ の文面は src/lib/faq.js の1か所だけにあり、
 * 画面（FaqSection.jsx）とここが同じデータを読んでいます。
 */
export function pluginJsonLd(plugin) {
  const pageUrl = pluginUrl(plugin.slug)

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: plugin.name,
      alternateName: plugin.nameEn || undefined,
      description: plugin.summary,
      url: pageUrl,
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: plugin.category || undefined,
      operatingSystem: 'kintone',
      softwareVersion: plugin.version,
      fileSize: plugin.zipSize ? `${Math.round(plugin.zipSize / 1024)}KB` : undefined,
      datePublished: plugin.releasedAt || undefined,
      inLanguage: 'ja',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'JPY',
        availability: 'https://schema.org/InStock',
      },
      publisher: {
        '@type': 'Organization',
        name: PUBLISHER_NAME,
        url: BUSINESS_SITE,
      },
    },
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
        { '@type': 'ListItem', position: 2, name: plugin.name, item: pageUrl },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: PLUGIN_FAQ.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    },
  ]
}
