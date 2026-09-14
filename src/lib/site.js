/**
 * 事業サイト（to.Morrow）へのリンクと、有料メニューの料金表記。
 *
 * プラグイン本体は無料のまま配布し、
 * 「設定・帳票作成を代行する」有料サービスへの導線だけをここで一元管理します。
 * 独自ドメインに移したときは BUSINESS_SITE の1行を書き換えるだけで済みます。
 */

export const BUSINESS_SITE = 'https://main.d3k8o4bbbbo4ke.amplifyapp.com'

export const links = {
  about: `${BUSINESS_SITE}/`,
  contact: `${BUSINESS_SITE}/#contact`,
  services: `${BUSINESS_SITE}/services.html`,
  reports: `${BUSINESS_SITE}/reports.html`,
  support: `${BUSINESS_SITE}/support.html`,
  terms: `${BUSINESS_SITE}/terms.html`,
  privacy: `${BUSINESS_SITE}/privacy.html`,
}

/**
 * 料金の表記。
 * 事業サイトの services.html と必ず同じ数字にしてください
 * （片方だけ直すと、見た金額と依頼ページの金額が食い違います）。
 */
export const prices = {
  report: '39,800円',
  setup: '19,800円',
  app: '49,800円',
}
