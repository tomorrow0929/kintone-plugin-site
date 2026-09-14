import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listPublishedPlugins, getFileUrl } from '../lib/api.js'
import { isConfigured } from '../lib/amplify.js'
import { formatBytes } from '../lib/format.js'
import { normalizeCategory, sortCategories } from '../lib/category.js'
import { usePageMeta } from '../lib/meta.js'
import { SITE_URL, SITE_NAME, BUSINESS_SITE, PUBLISHER_NAME } from '../lib/site.js'
import ServiceCta from '../components/ServiceCta.jsx'
import './PluginList.css'

export default function PluginList() {
  const [plugins, setPlugins] = useState([])
  const [icons, setIcons] = useState({})
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('すべて')
  const [state, setState] = useState(isConfigured ? 'loading' : 'idle')
  const [error, setError] = useState(null)

  /**
   * 構造化データ。
   * 「無料プラグインが何本あるサイトなのか」を検索エンジンに伝えます。
   */
  const jsonLd = useMemo(() => {
    if (plugins.length === 0) return null
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'kintone 無料プラグイン一覧',
        description: `to.Morrow が開発した kintone プラグイン ${plugins.length} 本を、すべて無料で配布しています。`,
        url: `${SITE_URL}/`,
        inLanguage: 'ja',
        isPartOf: {
          '@type': 'WebSite',
          name: SITE_NAME,
          url: `${SITE_URL}/`,
          publisher: { '@type': 'Organization', name: PUBLISHER_NAME, url: BUSINESS_SITE },
        },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: plugins.length,
          itemListElement: plugins.map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: p.name,
            url: `${SITE_URL}/plugins/${p.slug}`,
          })),
        },
      },
    ]
  }, [plugins])

  usePageMeta({
    title:
      plugins.length > 0
        ? `kintone 無料プラグイン ${plugins.length}本｜すべて無料・登録不要 | to.Morrow`
        : 'kintone 無料プラグイン一覧 | to.Morrow',
    description:
      '帳票出力・Excel出力・ガントチャート・一括更新など、業務で使える kintone プラグインをすべて無料で配布しています。会員登録不要、利用期限・出力枚数の制限もありません。',
    path: '/',
    jsonLd,
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
        if (!cancelled) {
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
    () => ['すべて', ...sortCategories([...new Set(plugins.map((p) => p.category).filter(Boolean))])],
    [plugins],
  )

  const visible = useMemo(() => {
    const word = keyword.trim().toLowerCase()
    return plugins.filter((p) => {
      const matchCategory = category === 'すべて' || p.category === category
      const matchWord =
        !word ||
        [p.name, p.nameEn, p.summary, p.description]
          .filter(Boolean)
          .some((t) => t.toLowerCase().includes(word))
      return matchCategory && matchWord
    })
  }, [plugins, keyword, category])

  return (
    <>
      <section className="hero">
        <h1>
          kintone 無料プラグイン
          {plugins.length > 0 && <span className="hero__count">全 {plugins.length} 本</span>}
        </h1>
        <p>
          to.Morrow が開発した kintone プラグインを<strong>すべて無料</strong>で配布しています。
          ダウンロードして、kintone の「プラグイン」画面から読み込んでご利用ください。
        </p>
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
            {categories.length > 1 && (
              <div className="filters__tabs">
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`chip${category === c ? ' chip--active' : ''}`}
                    onClick={() => setCategory(c)}
                  >
                    {c}
                  </button>
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
        </>
      )}
    </>
  )
}
