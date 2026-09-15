/**
 * カテゴリ名の表記ゆれをそろえる。
 *
 * 【なぜ必要か】
 * 登録時の入力によって「データ連携・インポート」と「データ連携・インポート系」の
 * 2つが別カテゴリとして並んでしまい、同じ仲間のプラグインが分断されていました。
 * DBを一括で直す前でも画面上は1つに見えるよう、表示の直前でここを通します。
 *
 * DB側を直したあとも、この関数は将来の打ち間違いを吸収する保険として残せます。
 */

/** 正式なカテゴリ名（この順で画面に並びます） */
export const CANONICAL_CATEGORIES = [
  '集計・レポート系',
  'データ連携・インポート系',
  '表示・UI改善系',
  'データ入力・操作系',
  '通知・アラート系',
]

export function normalizeCategory(value) {
  if (!value) return ''
  const trimmed = String(value).trim()
  if (CANONICAL_CATEGORIES.includes(trimmed)) return trimmed

  // 末尾の「系」が抜けているだけのものを救う（データ連携・インポート → 〜系）
  const withSuffix = `${trimmed}系`
  if (CANONICAL_CATEGORIES.includes(withSuffix)) return withSuffix

  return trimmed
}

/** プラグイン1件のカテゴリをそろえた新しいオブジェクトを返す */
export function withNormalizedCategory(plugin) {
  if (!plugin) return plugin
  return { ...plugin, category: normalizeCategory(plugin.category) }
}

/** 一覧に出すカテゴリを、正式な順番に並べ替える */
export function sortCategories(categories) {
  return [...categories].sort((a, b) => {
    const ia = CANONICAL_CATEGORIES.indexOf(a)
    const ib = CANONICAL_CATEGORIES.indexOf(b)
    if (ia === -1 && ib === -1) return a.localeCompare(b, 'ja')
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
}

/**
 * カテゴリごとのURLと説明文。
 *
 * 【なぜURLを持たせるか】
 * 以前はカテゴリの絞り込みが画面の中だけで完結していて、URLが変わりませんでした。
 * そのため「kintone ガントチャート 無料」のような
 * 「1本を探しているわけではないが、全36本の一覧でもない」検索に対して、
 * 出せるページがトップページしかありませんでした。
 * カテゴリごとに実URLを用意すると、その中間の検索を受けられます。
 *
 * slug はURLに出るので、あとから変えるとリンクが切れます。
 * カテゴリ名を変えるときも slug はそのまま残すのが安全です。
 *
 * lead は一覧ページとカテゴリページの見出し下に出す1行説明です
 * （計画8.2「各カテゴリに1行の説明を添える」）。
 */
export const CATEGORY_META = {
  '集計・レポート系': {
    slug: 'report',
    lead: 'kintone のレコードを、帳票・集計表・比較表の形にして外に出すためのプラグインです。',
  },
  'データ連携・インポート系': {
    slug: 'data-integration',
    lead: 'Excel や他のアプリとのやりとりを減らし、転記そのものを無くすためのプラグインです。',
  },
  '表示・UI改善系': {
    slug: 'display-ui',
    lead: '標準の一覧やレコード画面では見づらい情報を、見たい形で表示するためのプラグインです。',
  },
  'データ入力・操作系': {
    slug: 'input',
    lead: '入力の手間と間違いを減らし、決まった手順を自動で済ませるためのプラグインです。',
  },
  '通知・アラート系': {
    slug: 'notification',
    lead: '期限や条件に合うレコードを見落とさないようにするためのプラグインです。',
  },
}

/** カテゴリ名 → slug（例: '表示・UI改善系' → 'display-ui'） */
export function categorySlug(category) {
  return CATEGORY_META[normalizeCategory(category)]?.slug ?? null
}

/** slug → カテゴリ名（例: 'display-ui' → '表示・UI改善系'） */
export function categoryFromSlug(slug) {
  if (!slug) return null
  const found = Object.entries(CATEGORY_META).find(([, meta]) => meta.slug === slug)
  return found ? found[0] : null
}

/** カテゴリページのパス（canonical・sitemap・リンクで共通に使う） */
export function categoryPath(category) {
  const slug = categorySlug(category)
  return slug ? `/category/${slug}` : '/'
}

/** 見出しの下に出す1行説明 */
export function categoryLead(category) {
  return CATEGORY_META[normalizeCategory(category)]?.lead ?? ''
}
