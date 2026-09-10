import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listPublishedPlugins, getFileUrl } from '../lib/api.js'
import { isConfigured } from '../lib/amplify.js'
import { formatBytes } from '../lib/format.js'
import './PluginList.css'

export default function PluginList() {
  const [plugins, setPlugins] = useState([])
  const [icons, setIcons] = useState({})
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('すべて')
  const [state, setState] = useState(isConfigured ? 'loading' : 'idle')
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isConfigured) return
    let cancelled = false

    ;(async () => {
      try {
        const list = await listPublishedPlugins()
        if (cancelled) return
        setPlugins(list)
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
    () => ['すべて', ...new Set(plugins.map((p) => p.category).filter(Boolean))],
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
        <h1>kintone プラグイン</h1>
        <p>
          to.Morrow が開発した kintone プラグインを<strong>無料</strong>で配布しています。
          ダウンロードして、kintone の「プラグイン」画面から読み込んでご利用ください。
        </p>
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
