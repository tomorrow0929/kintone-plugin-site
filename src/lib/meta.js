/**
 * ページごとのタイトルと説明文を差し替える。
 *
 * 【なぜ必要か】
 * このサイトは1つの index.html で全ページを描いているため、
 * そのままだと36本すべての詳細ページが同じタイトル・同じ説明文になります。
 * 検索結果ではタイトルと説明文がほぼすべてなので、
 * プラグイン名が入っているかどうかで流入が大きく変わります。
 *
 * 検索エンジンがJavaScript実行後の内容を読むため、この方法で効果があります。
 * （より確実にしたい場合は、将来ビルド時にページを生成する形へ移行してください）
 */
import { useEffect } from 'react'

const DEFAULT_TITLE = 'kintone プラグイン | to.Morrow'

export function usePageMeta(title, description) {
  useEffect(() => {
    if (title) document.title = title

    if (description) {
      setMeta('name', 'description', description)
      setMeta('property', 'og:description', description)
    }
    if (title) setMeta('property', 'og:title', title)

    return () => {
      document.title = DEFAULT_TITLE
    }
  }, [title, description])
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
