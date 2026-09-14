/**
 * ページごとのタイトル・説明文・canonical・構造化データを差し替える。
 *
 * 【なぜ必要か】
 * このサイトは1つの index.html で全ページを描いているため、
 * そのままだと36本すべての詳細ページが同じタイトル・同じ説明文・
 * 同じ canonical になります。検索エンジンから見ると「同じページが36個ある」
 * 状態に近く、個別のプラグイン名では拾われません。
 *
 * 【canonical とは】
 * 「このページの正式なURLはこれです」と検索エンジンに伝えるタグです。
 * 旧URL（amplifyapp.com）や末尾スラッシュ違いで同じ内容が見えても、
 * 評価を1つのURLにまとめられます。
 *
 * 検索エンジンはJavaScript実行後の内容を読むため、この方法で効果があります。
 * より確実にしたい場合は、将来ビルド時にHTMLを生成する形へ移行してください。
 */
import { useEffect } from 'react'
import { SITE_URL } from './site.js'

const DEFAULT_TITLE = 'kintone 無料プラグイン一覧 | to.Morrow'
const DEFAULT_DESCRIPTION =
  '帳票出力・Excel出力・ガントチャート・一括更新など、業務で使える kintone プラグインをすべて無料で配布しています。会員登録不要、利用期限・出力枚数の制限もありません。'

/** このスクリプトが管理しているJSON-LDの目印（差し替え時に消すため） */
const JSONLD_FLAG = 'data-page-jsonld'

/**
 * @param {object} options
 * @param {string}  [options.title]         ページタイトル
 * @param {string}  [options.description]   説明文
 * @param {string}  [options.path]          "/plugins/xxx" のようなパス（canonical に使う）
 * @param {object|object[]} [options.jsonLd] 構造化データ
 * @param {boolean} [options.noindex]       検索結果に出したくないページ（管理画面など）
 */
export function usePageMeta({ title, description, path, jsonLd, noindex } = {}) {
  // 依存配列を安定させるため、オブジェクトは文字列にしてから比較する
  const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : ''

  useEffect(() => {
    document.title = title || DEFAULT_TITLE

    const desc = description || DEFAULT_DESCRIPTION
    setMeta('name', 'description', desc)
    setMeta('property', 'og:description', desc)
    setMeta('property', 'og:title', title || DEFAULT_TITLE)

    if (path) {
      const url = `${SITE_URL}${path}`
      setLink('canonical', url)
      setMeta('property', 'og:url', url)
    }

    // 管理画面など、検索結果に出したくないページ
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow')

    // 構造化データ（前のページのものを消してから入れ直す）
    removeJsonLd()
    if (jsonLdKey) {
      const script = document.createElement('script')
      script.type = 'application/ld+json'
      script.setAttribute(JSONLD_FLAG, '1')
      script.textContent = jsonLdKey
      document.head.appendChild(script)
    }

    return () => {
      document.title = DEFAULT_TITLE
      removeJsonLd()
    }
  }, [title, description, path, jsonLdKey, noindex])
}

function setMeta(attr, key, content) {
  let tag = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attr, key)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

function setLink(rel, href) {
  let tag = document.head.querySelector(`link[rel="${rel}"]`)
  if (!tag) {
    tag = document.createElement('link')
    tag.setAttribute('rel', rel)
    document.head.appendChild(tag)
  }
  tag.setAttribute('href', href)
}

function removeJsonLd() {
  document.head.querySelectorAll(`script[${JSONLD_FLAG}]`).forEach((el) => el.remove())
}
