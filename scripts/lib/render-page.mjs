/**
 * プラグイン詳細ページのHTMLを1本ぶん組み立てる。
 *
 * 呼び出し元は scripts/prerender.mjs（DBから取った内容を渡してくる）。
 * ここはファイルもネットワークも触らない純粋な組み立て役なので、
 * 適当なデータを渡せばそのまま動作を確認できます。
 *
 * 【文言を変えるときの注意】
 * 下の buildBody() は PluginDetail.jsx / ServiceCta.jsx / UsageSection.jsx の
 * 文言を静的HTML用に書き写したものです。
 * 表示される文章を変えたときは、React 側とこちらの両方を直してください。
 * 一方だけ直しても表示は壊れませんが（Reactが上書きするため）、
 * クローラーには古い文章が見えたままになります。
 *
 * タイトル・説明文・構造化データは src/lib/plugin-meta.js にまとめてあるので、
 * そちらを直す場所は1か所だけです。
 */
import { links, prices } from '../../src/lib/site.js'
import { categoryPath, categoryLead, sortCategories } from '../../src/lib/category.js'
import {
  listPath,
  listUrl,
  listPageTitle,
  listPageDescription,
  listPageJsonLd,
} from '../../src/lib/list-meta.js'
import { PLUGIN_FAQ } from '../../src/lib/faq.js'
import { normalizeUsage, isUsageEmpty } from '../../src/lib/usage.js'
import { formatBytes, formatDate } from '../../src/lib/format.js'
import {
  pluginPath,
  pluginUrl,
  pluginPageTitle,
  pluginPageDescription,
  pluginJsonLd,
} from '../../src/lib/plugin-meta.js'

/** HTMLに文字を埋め込むときのエスケープ（本文・属性値の両方に使う） */
function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * <script> の中にJSONを書くときのエスケープ。
 * 文字列の中に </script> が入っているとそこでタグが閉じてしまうため、
 * < を < に置き換えておく。
 */
function jsonForScript(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c')
}

/** 改行区切りの文章を <p> に分ける */
function paragraphs(text) {
  return String(text ?? '')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => `<p>${esc(line)}</p>`)
    .join('')
}

/**
 * head の中の1つのタグを差し替える。
 * 見つからなかったときは </head> の直前に足す（テンプレートの変更に強くする）。
 */
function replaceInHead(html, pattern, tag) {
  if (pattern.test(html)) return html.replace(pattern, tag)
  return html.replace('</head>', `  ${tag}\n  </head>`)
}

/**
 * テンプレートの head を、そのページ用の内容に差し替える。
 * 詳細ページ・トップ・カテゴリページで共用する。
 */
function buildHead(html, { title, description, url, jsonLd }) {
  let out = html
  out = replaceInHead(out, /<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
  out = replaceInHead(
    out,
    /<meta\b[^>]*\bname="description"[^>]*>/,
    `<meta name="description" content="${esc(description)}" />`,
  )
  out = replaceInHead(
    out,
    /<link\b[^>]*\brel="canonical"[^>]*>/,
    `<link rel="canonical" href="${esc(url)}" />`,
  )
  out = replaceInHead(
    out,
    /<meta\b[^>]*\bproperty="og:title"[^>]*>/,
    `<meta property="og:title" content="${esc(title)}" />`,
  )
  out = replaceInHead(
    out,
    /<meta\b[^>]*\bproperty="og:description"[^>]*>/,
    `<meta property="og:description" content="${esc(description)}" />`,
  )
  out = replaceInHead(
    out,
    /<meta\b[^>]*\bproperty="og:url"[^>]*>/,
    `<meta property="og:url" content="${esc(url)}" />`,
  )

  /**
   * 構造化データ。
   * data-page-jsonld を付けておくと、React 側（src/lib/meta.js）が
   * 起動時にこれを取り除いて自分のものを入れ直します。
   * この目印が無いと同じ構造化データが2つ並びます。
   */
  if (!jsonLd) return out

  const tag = `<script type="application/ld+json" data-page-jsonld="1">${jsonForScript(
    jsonLd,
  )}</script>`

  return out.replace('</head>', `  ${tag}\n  </head>`)
}

/** ヘッダー（src/components/Header.jsx と同じ見た目） */
function buildHeader() {
  return `<header class="site-header">
<a href="/" class="site-header__brand"><img src="/logo.svg" alt="to.Morrow" class="site-header__logo" /><span class="site-header__label">kintone プラグイン</span></a>
<nav class="site-header__nav">
<a href="/" aria-current="page">プラグイン一覧</a>
<a href="${esc(links.services)}" target="_blank" rel="noreferrer">料金・代行</a>
<a href="${esc(links.about)}" target="_blank" rel="noreferrer">to.Morrow について</a>
</nav>
</header>`
}

/** フッター（src/components/Footer.jsx と同じ見た目） */
function buildFooter() {
  return `<footer class="site-footer">
<p class="site-footer__links">
<a href="${esc(links.services)}" target="_blank" rel="noreferrer">有料メニュー・料金</a> ｜
<a href="${esc(links.support)}" target="_blank" rel="noreferrer">サポート範囲</a> ｜
<a href="${esc(links.terms)}" target="_blank" rel="noreferrer">利用規約</a> ｜
<a href="${esc(links.privacy)}" target="_blank" rel="noreferrer">プライバシーポリシー</a> ｜
<a href="${esc(links.contact)}" target="_blank" rel="noreferrer">お問い合わせ</a>
</p>
<p>&copy; ${new Date().getFullYear()} to.Morrow</p>
<p class="site-footer__note">kintone はサイボウズ株式会社の登録商標です。本サイトはサイボウズ株式会社とは関係のない、to.Morrow が独自に開発・提供するプラグインの配布ページです。</p>
</footer>`
}

/** 「使い方」（src/components/UsageSection.jsx と同じ。画像は React 側で後から入る） */
function buildUsage(usage) {
  if (isUsageEmpty(usage)) return ''

  const steps = usage.steps
    .filter((step) => step.title.trim() || step.body.trim())
    .map(
      (step) => `<li class="usage__step"><div class="usage__stepbody">${
        step.title ? `<h3>${esc(step.title)}</h3>` : ''
      }${paragraphs(step.body)}</div></li>`,
    )
    .join('')

  return `<section class="usage" id="usage">
<h2>使い方</h2>
${usage.intro ? `<p class="usage__intro">${esc(usage.intro)}</p>` : ''}
${steps ? `<ol class="usage__steps">${steps}</ol>` : ''}
${
  usage.notes
    ? `<div class="usage__notes"><h3>注意点</h3>${paragraphs(usage.notes)}</div>`
    : ''
}
</section>`
}

/** 有料メニューへの導線（src/components/ServiceCta.jsx と同じ） */
function buildServiceCta(plugin, isReport) {
  const primaryHref = isReport ? links.reports : links.services
  const primaryLabel = isReport ? '帳票作成代行について見る' : '料金と依頼の流れを見る'

  return `<section class="service-cta">
<h2>設定でつまずいたら、代行できます</h2>
<p class="service-cta__lead">${esc(plugin.name)}を含め、プラグイン本体は無料のままご利用いただけます。ご自身で設定する時間が取れないときだけ、作業をお引き受けします。</p>
<ul class="service-cta__menu">
<li><span class="service-cta__name">帳票テンプレート作成代行</span><span class="service-cta__price">${esc(prices.report)}〜</span><span class="service-cta__note">台紙PDFの作成、項目の配置、テンプレート登録、実データでの出力確認まで</span></li>
<li><span class="service-cta__name">プラグイン初期設定代行</span><span class="service-cta__price">${esc(prices.setup)}〜</span><span class="service-cta__note">1アプリ・プラグイン3本までの設定と動作確認</span></li>
<li><span class="service-cta__name">kintoneアプリ作成・カスタマイズ</span><span class="service-cta__price">${esc(prices.app)}〜</span><span class="service-cta__note">アプリの設計・構築、JavaScript カスタマイズ、プラグインの個別改修</span></li>
</ul>
<div class="service-cta__actions">
<a class="button" href="${esc(primaryHref)}" target="_blank" rel="noreferrer">${esc(primaryLabel)}</a>
<a class="button button--ghost" href="${esc(links.contact)}" target="_blank" rel="noreferrer">無料で相談する</a>
</div>
<p class="service-cta__fineprint">お見積りまで費用はかかりません。ご相談内容によっては、設定を変えるだけで解決できる場合もあります。その場合はそのようにお伝えします。</p>
</section>`
}

/**
 * 関連プラグイン。
 * 同じカテゴリを先に、足りなければ他のカテゴリから補って4本。
 * PluginDetail.jsx と同じ選び方です。
 *
 * ここで書き出すリンクは、クローラーが36本を見つける道にもなります。
 */
function buildRelated(plugin, all) {
  const others = all.filter((p) => p.slug !== plugin.slug)
  const sameCategory = others.filter((p) => p.category && p.category === plugin.category)
  const picked = [...sameCategory, ...others.filter((p) => !sameCategory.includes(p))].slice(0, 4)
  if (picked.length === 0) return ''

  const items = picked
    .map(
      (p) => `<li><a href="${esc(pluginPath(p.slug))}"><span class="detail__related-name">${esc(
        p.name,
      )}</span><span class="detail__related-summary">${esc(p.summary)}</span></a></li>`,
    )
    .join('')

  return `<section class="detail__section"><h2>あわせて使えるプラグイン</h2><ul class="detail__related">${items}</ul></section>`
}

/** よくあるご質問（src/components/FaqSection.jsx と同じ。中身は faq.js から） */
function buildFaq() {
  const items = PLUGIN_FAQ.map(
    (item) =>
      `<div class="faq__item"><dt>${esc(item.q)}</dt><dd>${esc(item.a)}</dd></div>`,
  ).join('')

  return `<section class="faq">
<h2>よくあるご質問</h2>
<dl class="faq__list">${items}</dl>
<p class="faq__more">ここに無い場合は <a href="${esc(links.support)}" target="_blank" rel="noreferrer">サポート範囲</a> ・ <a href="${esc(
    links.terms,
  )}" target="_blank" rel="noreferrer">利用規約</a> をご確認のうえ、<a href="${esc(
    links.contact,
  )}" target="_blank" rel="noreferrer">お問い合わせ</a> からお寄せください。</p>
</section>`
}

/** 帳票まわりのプラグインかどうか（PluginDetail.jsx の isReportPlugin と同じ） */
function isReportPlugin(plugin) {
  return /帳票|form-output|report|pdf|PDF/.test(`${plugin.slug ?? ''} ${plugin.name ?? ''}`)
}

/** #root の中身。React が起動したら同じ内容で描き直される */
function buildBody(plugin, all) {
  const usage = normalizeUsage(plugin.usage)

  const facts = [
    `<div><dt>バージョン</dt><dd>v${esc(plugin.version)}</dd></div>`,
    plugin.zipSize ? `<div><dt>サイズ</dt><dd>${esc(formatBytes(plugin.zipSize))}</dd></div>` : '',
    plugin.category ? `<div><dt>カテゴリ</dt><dd>${esc(plugin.category)}</dd></div>` : '',
    plugin.releasedAt
      ? `<div><dt>公開日</dt><dd>${esc(formatDate(plugin.releasedAt))}</dd></div>`
      : '',
  ].join('')

  return `${buildHeader()}
<main class="page">
<article class="detail">
<nav class="detail__back" aria-label="パンくず"><a href="/">← kintone 無料プラグイン一覧</a>${
    plugin.category
      ? `<a href="${esc(categoryPath(plugin.category))}" class="detail__crumb">${esc(
          plugin.category,
        )}</a>`
      : ''
  }</nav>
<header class="detail__header">
<div class="detail__icon"><span aria-hidden="true">🧩</span></div>
<div>
<h1>${esc(plugin.name)}</h1>
${plugin.nameEn ? `<p class="detail__subtitle">${esc(plugin.nameEn)}</p>` : ''}
<p class="detail__summary">${esc(plugin.summary)}</p>
</div>
</header>
<div class="detail__actions">
<button type="button" class="button">ダウンロード（無料）</button>
<dl class="detail__facts">${facts}</dl>
</div>
<ul class="detail__badges"><li>無料</li><li>会員登録不要</li><li>商用利用可</li><li>利用期限なし</li></ul>
${
  plugin.description
    ? `<section class="detail__section"><h2>できること</h2>${paragraphs(plugin.description)}</section>`
    : ''
}
${buildUsage(usage)}
<section class="detail__section">
<h2>導入方法</h2>
<ol class="detail__steps">
<li>上の「ダウンロード」ボタンで zip ファイルを保存します。</li>
<li>kintone にログインし、右上の歯車から <strong>kintone システム管理</strong> → <strong>プラグイン</strong> を開きます。</li>
<li><strong>読み込む</strong> をクリックし、保存した zip ファイルを選択します。</li>
<li>プラグインを使いたいアプリを開き、<strong>アプリの設定</strong> → <strong>プラグイン</strong> → <strong>追加する</strong> で選択します。</li>
<li>歯車アイコンから設定を行い、アプリを更新すれば完了です。</li>
</ol>
</section>
${buildServiceCta(plugin, isReportPlugin(plugin))}
${buildRelated(plugin, all)}
${buildFaq()}
<section class="detail__section detail__section--note">
<h2>ご利用にあたって</h2>
<p>本プラグインは無料で提供しているため、動作保証・対応期限の確約（SLA）はありません。ご利用によって生じた損害について、to.Morrow は責任を負いかねます。まずはテスト環境でお試しいただくことをおすすめします。</p>
<p>再現手順のわかる不具合のご報告は無償で受け付けています（返信は週2回まとめてお返しします）。個別の設定代行・環境固有の調査・機能追加は有料メニューにて承ります。</p>
<p><a href="${esc(links.support)}" target="_blank" rel="noreferrer">無償サポートの範囲</a> ｜ <a href="${esc(
    links.terms,
  )}" target="_blank" rel="noreferrer">利用規約</a> ｜ <a href="${esc(
    links.contact,
  )}" target="_blank" rel="noreferrer">お問い合わせ</a></p>
</section>
</article>
</main>
${buildFooter()}`
}

/** 1本分のHTMLを組み立てる（このモジュールの入口） */
export function buildPage(template, plugin, all) {
  let html = buildHead(template, {
    title: pluginPageTitle(plugin),
    description: pluginPageDescription(plugin),
    url: pluginUrl(plugin.slug),
    jsonLd: pluginJsonLd(plugin),
  })

  // React に渡すデータ。type="module" のスクリプトより先に実行される。
  const seed = `<script>window.__PRERENDERED_PLUGIN__ = ${jsonForScript(plugin)}</script>`

  html = html.replace(
    '<div id="root"></div>',
    `${seed}\n    <div id="root">${buildBody(plugin, all)}</div>`,
  )

  return html
}


/** 一覧のカード1枚（src/pages/PluginList.jsx の plugin-card と同じ） */
function buildCard(plugin) {
  return `<li><a href="${esc(pluginPath(plugin.slug))}" class="plugin-card">
<div class="plugin-card__icon"><span aria-hidden="true">🧩</span></div>
<div class="plugin-card__body">
<h2>${esc(plugin.name)}</h2>
<p>${esc(plugin.summary)}</p>
<div class="plugin-card__meta">${
    plugin.category ? `<span class="tag">${esc(plugin.category)}</span>` : ''
  }<span>v${esc(plugin.version)}</span>${
    plugin.zipSize ? `<span>${esc(formatBytes(plugin.zipSize))}</span>` : ''
  }</div>
</div>
</a></li>`
}

/** カテゴリの切り替えリンク（PluginList.jsx の filters__tabs と同じ） */
function buildCategoryTabs(categories, activeCategory) {
  const all = `<a href="/" class="chip${activeCategory ? '' : ' chip--active'}">すべて</a>`
  const rest = categories
    .map(
      (c) =>
        `<a href="${esc(categoryPath(c))}" class="chip${
          activeCategory === c ? ' chip--active' : ''
        }">${esc(c)}</a>`,
    )
    .join('')
  return `<div class="filters"><div class="filters__tabs">${all}${rest}</div></div>`
}

/** カテゴリページ下部の「ほかのカテゴリ」 */
function buildOtherCategories(categories, activeCategory) {
  const others = categories.filter((c) => c !== activeCategory)
  if (others.length === 0) return ''

  const items = others
    .map(
      (c) =>
        `<li><a href="${esc(categoryPath(c))}">${esc(c)}</a><span>${esc(
          categoryLead(c),
        )}</span></li>`,
    )
    .join('')

  return `<section class="other-categories"><h2>ほかのカテゴリ</h2><ul>${items}</ul></section>`
}

/**
 * トップページとカテゴリページのHTMLを組み立てる（このモジュールの入口）。
 *
 * category に null を渡すとトップ（全件）、カテゴリ名を渡すとそのカテゴリページ。
 * 検索欄はJavaScriptが要るので静的HTMLには出さない。
 * クローラーと、JSが動く前の利用者に必要なのは「一覧そのもの」なので、
 * カードとカテゴリのリンクだけを先に出しておく。
 *
 * 文言は src/pages/PluginList.jsx から書き写したもの。
 * 表示される文章を変えたときは両方を直すこと。
 */
export function buildListPage(template, category, allPlugins) {
  const plugins = category ? allPlugins.filter((p) => p.category === category) : allPlugins
  const categories = sortCategories([
    ...new Set(allPlugins.map((p) => p.category).filter(Boolean)),
  ])

  let html = buildHead(template, {
    title: listPageTitle(category, plugins.length),
    description: listPageDescription(category, plugins),
    url: listUrl(category),
    jsonLd: listPageJsonLd(category, plugins),
  })

  const hero = category
    ? `<section class="hero">
<nav class="hero__back" aria-label="パンくず"><a href="/">← kintone 無料プラグイン一覧</a></nav>
<h1>kintone ${esc(category)}の無料プラグイン<span class="hero__count">全 ${
        plugins.length
      } 本</span></h1>
<p>${esc(categoryLead(category))}</p>
<ul class="hero__badges"><li>無料</li><li>会員登録不要</li><li>出力枚数の制限なし</li><li>利用期限なし</li><li>商用利用可</li></ul>
</section>`
    : `<section class="hero">
<h1>kintone 無料プラグイン<span class="hero__count">全 ${plugins.length} 本</span></h1>
<p>to.Morrow が開発した kintone プラグインを<strong>すべて無料</strong>で配布しています。ダウンロードして、kintone の「プラグイン」画面から読み込んでご利用ください。</p>
<ul class="hero__badges"><li>無料</li><li>会員登録不要</li><li>出力枚数の制限なし</li><li>利用期限なし</li><li>商用利用可</li></ul>
</section>`

  const banner = `<aside class="service-banner">
<p class="service-banner__text"><strong>設定や帳票づくりでお困りですか？</strong><span>台紙の作成から項目の配置、動作確認までを代行しています（帳票作成代行 ${esc(
    prices.report,
  )}〜／ 初期設定代行 ${esc(prices.setup)}〜）。</span></p>
<a class="button button--compact" href="${esc(
    links.services,
  )}" target="_blank" rel="noreferrer">料金を見る</a>
</aside>`

  const body = `${buildHeader()}
<main class="page">
${hero}
${banner}
${buildCategoryTabs(categories, category)}
<ul class="plugin-grid">${plugins.map(buildCard).join('')}</ul>
${category ? buildOtherCategories(categories, category) : ''}
</main>
${buildFooter()}`

  // React に渡す一覧。カテゴリページでも全件を渡す（絞り込みはURLが決める）。
  const seed = `<script>window.__PRERENDERED_LIST__ = ${jsonForScript(allPlugins)}</script>`

  return html.replace('<div id="root"></div>', `${seed}\n    <div id="root">${body}</div>`)
}
