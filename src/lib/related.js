/**
 * 「あわせて使えるプラグイン」の選び方。
 *
 * 画面（PluginDetail.jsx）と静的HTML（scripts/lib/render-page.mjs）の両方から使うので、
 * 選び方はここ1か所にまとめています。片方だけ直すと、検索エンジンに見える内容と画面がずれます。
 *
 * 【選ぶ順番】
 *   1. PAIRS に書いた「一緒に使う相手」
 *   2. 同じカテゴリのプラグイン（一覧の並び順）
 *   3. 足りなければ他のカテゴリから
 * で、最大4本。
 *
 * 【PAIRS がある理由】
 * カテゴリだけで選ぶと、別カテゴリだが一緒に使うと便利なもの
 * （例：手書きサインで書いた署名を帳票出力で印刷する）がお互いに出ませんでした。
 */

/** 一緒に使う相手（slug）。片方に書けば、逆向きにも出ます */
const PAIRS = [
  ['to-morrow-form-output-plugin', 'handwritten-signature-plugin'],
]

export const RELATED_LIMIT = 4

function partnersOf(slug) {
  const result = []
  PAIRS.forEach(([a, b]) => {
    if (a === slug) result.push(b)
    if (b === slug) result.push(a)
  })
  return result
}

/**
 * @param plugin 表示中のプラグイン（slug・category を使う）
 * @param all    公開中のプラグイン（一覧の並び順・カテゴリはそろえ済み）
 */
export function pickRelated(plugin, all) {
  const others = all.filter((p) => p.slug !== plugin.slug)
  const partners = partnersOf(plugin.slug)
    .map((slug) => others.find((p) => p.slug === slug))
    .filter(Boolean)
  const sameCategory = others.filter((p) => p.category && p.category === plugin.category)

  const picked = []
  ;[...partners, ...sameCategory, ...others].forEach((p) => {
    if (!picked.includes(p)) picked.push(p)
  })
  return picked.slice(0, RELATED_LIMIT)
}
