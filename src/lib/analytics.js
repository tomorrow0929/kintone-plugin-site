/**
 * アクセス計測（Google アナリティクス GA4）。
 *
 * 【設定していないときは何もしません】
 * 環境変数 VITE_GA_ID が空のあいだは、スクリプトを読み込まず
 * track() も黙って無視します。そのため、計測を入れる前でも
 * この仕組みが原因で画面が壊れることはありません。
 *
 * 【有効にする手順】
 *  1. GA4 で測定ID（G-XXXXXXXXXX）を取得する
 *  2. Amplify コンソールの「環境変数」に VITE_GA_ID = G-XXXXXXXXXX を追加
 *  3. 再デプロイ（ビルド時に値が埋め込まれます）
 *
 * ローカルで試すときは、プロジェクト直下に .env.local を作って
 *   VITE_GA_ID=G-XXXXXXXXXX
 * と書きます（.env.local は Git に入れないでください）。
 */

const GA_ID = import.meta.env?.VITE_GA_ID ?? ''

export const isAnalyticsEnabled = Boolean(GA_ID)

export function initAnalytics() {
  if (!isAnalyticsEnabled || typeof window === 'undefined') return
  if (window.gtag) return // 二重読み込みを防ぐ

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
  document.head.appendChild(script)

  window.dataLayer = window.dataLayer || []
  // gtag は arguments をそのまま積む仕様なので、アロー関数にはできません
  function gtag() {
    window.dataLayer.push(arguments)
  }
  window.gtag = gtag
  gtag('js', new Date())
  gtag('config', GA_ID)
}

/**
 * イベントを送る。
 * 計測が未設定なら何もしないので、呼び出し側で分岐は不要です。
 */
export function track(name, params = {}) {
  if (typeof window === 'undefined' || !window.gtag) return
  try {
    window.gtag('event', name, params)
  } catch {
    // 計測の失敗で利用者の操作を止めない
  }
}

/**
 * ダウンロードを記録する。
 *
 * source には「どこから押されたか」を入れます（detail / list など）。
 * どの経路のダウンロードが多いかが分かると、
 * 一覧ページの見せ方を直すべきか、記事を増やすべきかの判断がつきます。
 */
export function trackDownload({ slug, name, category, source }) {
  track('plugin_download', {
    plugin_slug: slug ?? '',
    plugin_name: name ?? '',
    plugin_category: category ?? '',
    source: source ?? 'unknown',
  })
}

/** 有料メニューへの導線がどれだけ押されたか */
export function trackCtaClick({ location, target }) {
  track('service_cta_click', { cta_location: location ?? '', cta_target: target ?? '' })
}
