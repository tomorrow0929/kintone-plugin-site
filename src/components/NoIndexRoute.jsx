import { usePageMeta } from '../lib/meta.js'

/**
 * 検索結果に出したくないページを包むための部品。
 *
 * 管理画面が検索に載ると、ログイン画面が検索結果に出てきて
 * 総当たりの試行を招きます。robots.txt でも弾いていますが、
 * ページ側にも noindex を出して二重に防ぎます。
 */
export default function NoIndexRoute({ title, children }) {
  usePageMeta({ title, noindex: true })
  return children
}
