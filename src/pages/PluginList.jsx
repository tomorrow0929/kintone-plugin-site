import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { listPublishedPlugins, getFileUrl } from '../lib/api.js'
import { isConfigured } from '../lib/amplify.js'
import { formatBytes } from '../lib/format.js'
import {
  normalizeCategory,
  sortCategories,
  categoryFromSlug,
  categoryPath,
  categoryLead,
} from '../lib/category.js'
import { usePageMeta } from '../lib/meta.js'
import { listPath, listPageTitle, listPageDescription, listPageJsonLd } from '../lib/list-meta.js'
import ServiceCta from '../components/ServiceCta.jsx'
import './PluginList.css'

/**
 * ビルド時にHTMLへ埋め込んだ一覧を取り出す（scripts/prerender.mjs が書き込む）。
 * 静的HTMLに一覧が入っているのに、React起動直後に「読み込み中…」へ
 * 戻ってしまうと見づらいため、最初の表示はこれを使う。
 */
function readPrerenderedList() {
  if (typeof window === 'undefined') return null
  const list = window.__PRERENDERED_LIST__
  if (!Array.isArray(list) || list.length === 0) return null
  return list.map((p) => ({ ...p, category: normalizeCategory(p.category) }))
}

/**
 * プラグイン一覧。
 *
 * トップ（/）と、カテゴリページ（/category/<slug>）の両方をこの1つで描く。
 * どのカテゴリを見ているかは**URLが持つ**（画面の状態としては持たない）。
 * こうしないとカテゴリごとのURLが存在せず、
 * 「kintone ガントチャート 無料」のような検索を受けるページが作れない。
 */
export default function PluginList() {
  const { slug } = useParams()
  const activeCategory = categoryFromSlug(slug)

  /**
   * URLのカテゴリが存在しない場合（打ち間違い、カテゴリを廃止したあとの古いリンク）。
   * 全件の一覧を出してしまうと、同じ内容のページがいくつも見えることになるので、
   * 「見つかりません」を出して noindex にする。
   * 本番では Amplify がこのURLに404ステータスを返すので、表示と食い違わない。
   */
  const notFound = Boolean(slug && !activeCategory)

  const [plugins, setPlugins] = useState(() => readPrerenderedList() ?? [])
  const [icons, setIcons] = useState({})
  const [keyword, setKeyword] = useState('')
  const [state, setState] = useState(() => {
    if (readPrerenderedList()) return 'done'
    return isConfigured ? 'loading' : 'idle'
  })
  const [error, setError] = useState(null)

  // このページに実際に並ぶもの（カテゴリで絞ったあと）。
  // 構造化データにも同じ配列を渡す。画面に無いものを載せてはいけない。
  const inCategory = useMemo(
    () => (activeCategory ? plugins.filter((p) => p.category === activeCategory) : plugins),
    [plugins, activeCategory],
  )

  const jsonLd = useMemo(
    () => listPageJsonLd(activeCategory, inCategory),
    [activeCategory, inCategory],
  )

  usePageMeta({
    title: notFound
      ? 'カテゴリが見つかりません | to.Morrow'
      : listPageTitle(activeCategory, inCategory.length),
    description: notFound ? undefined : listPageDescription(activeCategory, inCategory),
    path: notFound ? undefined : listPath(activeCategory),
    jsonLd: notFound ? null : jsonLd,
    noindex: notFound,
  })

  useEffect(() => {
    if (!isConfigured) return
    let cancelled = false

    ;(async () => {
      try {
        const list = await listPublishedPlugins()
        if (cancelled) return
        // カテゴリの表記ゆれ（「〜」と「〜系」）をここでそろえる
        setPlugins(list.map((p) => ({ ...p, category: normalizeCategory(p.category) })))
        setState('done')

        // アイコンのURLは後から個別に解決する
        const entries = await Promise.all(
          list
            .filter((p) => p.iconKey)
            .map(async (p) => [p.id, await getFileUrl(p.iconKey).catch(() => null)]),
        )
        if (!cancelled) setIcons(Object.fromEntries(entries))
      } catch (e) {
        if (cancelled) return
        // 埋め込み済みの一覧があるなら、通信の失敗で消さない
        if (!readPrerenderedList()) {
          setError(e.message)
          setState('error')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const categories = useMemo(
    () => sortCategories([...new Set(plugins.map((p) => p.category).filter(Boolean))]),
    [plugins],
  )

  const visible = useMemo(() => {
    const word = keyword.trim().toLowerCase()
    if (!word) return inCategory
    return inCategory.filter((p) =>
      [p.name, p.nameEn, p.summary, p.description]
        .filter(Boolean)
        .some((t) => t.toLowerCase().includes(word)),
    )
  }, [inCategory, keyword])

  if (notFound) {
    return (
      <div className="status">
        <h1>カテゴリが見つかりません</h1>
        <p>
          <Link to="/">kintone 無料プラグイン一覧へ</Link>
        </p>
      </div>
    )
  }

  return (
    <>
      <section className="hero">
        {activeCategory ? (
          <>
            {/* パンくず。カテゴリページから一覧に戻れるようにする */}
            <nav className="hero__back" aria-label="パンくず">
              <Link to="/">← kintone 無料プラグイン一覧</Link>
            </nav>
            <h1>
              kintone {activeCategory}の無料プラグイン
              {inCategory.length > 0 && (
                <span className="hero__count">全 {inCategory.length} 本</span>
              )}
            </h1>
            <p>{categoryLead(activeCategory)}</p>
          </>
        ) : (
          <>
            <h1>
              kintone 無料プラグイン
              {plugins.length > 0 && <span className="hero__count">全 {plugins.length} 本</span>}
            </h1>
            <p>
              to.Morrow が開発した kintone プラグインを<strong>すべて無料</strong>
              で配布しています。 ダウンロードして、kintone の「プラグイン」画面から読み込んでご利用ください。
            </p>
          </>
        )}
        {/* 他社の有料サービスと比べたときに、何が無いのかを先に書いておく */}
        <ul className="hero__badges">
          <li>無料</li>
          <li>会員登録不要</li>
          <li>出力枚数の制限なし</li>
          <li>利用期限なし</li>
          <li>商用利用可</li>
        </ul>
      </section>

      {state === 'loading' && <p className="status">読み込み中…</p>}

      {state === 'error' && (
        <p className="status status--error">
          読み込みに失敗しました。時間をおいて再度お試しください。
          <br />
          <small>{error}</small>
        </p>
      )}

      {state === 'done' && (
        <>
          <ServiceCta variant="banner" />

          <div className="filters">
            <input
              type="search"
              className="filters__search"
              placeholder="キーワードで絞り込み"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              aria-label="キーワードで絞り込み"
            />
            {categories.length > 0 && (
              <div className="filters__tabs">
                {/*
                  ボタンではなくリンクにしている。
                  押すとURLが変わるので、絞り込んだ状態を共有・ブックマークできるうえ、
                  検索エンジンがカテゴリページを見つけられる。
                */}
                <Link to="/" className={`chip${activeCategory ? '' : ' chip--active'}`}>
                  すべて
                </Link>
                {categories.map((c) => (
                  <Link
                    key={c}
                    to={categoryPath(c)}
                    className={`chip${activeCategory === c ? ' chip--active' : ''}`}
                  >
                    {c}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {visible.length === 0 ? (
            <p className="status">
              {plugins.length === 0
                ? '公開中のプラグインはまだありません。'
                : '条件に合うプラグインが見つかりませんでした。'}
            </p>
          ) : (
            <ul className="plugin-grid">
              {visible.map((p) => (
                <li key={p.id}>
                  <Link to={`/plugins/${p.slug}`} className="plugin-card">
                    <div className="plugin-card__icon">
                      {icons[p.id] ? (
                        <img src={icons[p.id]} alt="" loading="lazy" />
                      ) : (
                        <span aria-hidden="true">🧩</span>
                      )}
                    </div>
                    <div className="plugin-card__body">
                      <h2>{p.name}</h2>
                      <p>{p.summary}</p>
                      <div className="plugin-card__meta">
                        {p.category && <span className="tag">{p.category}</span>}
                        <span>v{p.version}</span>
                        {p.zipSize ? <span>{formatBytes(p.zipSize)}</span> : null}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {/* カテゴリページからは、他のカテゴリへも回れるようにする */}
          {activeCategory && categories.length > 1 && (
            <section className="other-categories">
              <h2>ほかのカテゴリ</h2>
              <ul>
                {categories
                  .filter((c) => c !== activeCategory)
                  .map((c) => (
                    <li key={c}>
                      <Link to={categoryPath(c)}>{c}</Link>
                      <span>{categoryLead(c)}</span>
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  )
}
