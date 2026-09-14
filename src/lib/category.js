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
