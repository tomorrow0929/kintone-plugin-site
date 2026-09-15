import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  getPluginBySlug,
  getFileUrl,
  countDownload,
  listPublishedPlugins,
} from '../lib/api.js'
import { isConfigured } from '../lib/amplify.js'
import { formatBytes, formatDate } from '../lib/format.js'
import { normalizeUsage } from '../lib/usage.js'
import { normalizeCategory, withNormalizedCategory } from '../lib/category.js'
import { usePageMeta } from '../lib/meta.js'
import {
  pluginPath,
  pluginPageTitle,
  pluginPageDescription,
  pluginJsonLd,
} from '../lib/plugin-meta.js'
import { trackDownload } from '../lib/analytics.js'
import { links } from '../lib/site.js'
import UsageSection from '../components/UsageSection.jsx'
import ServiceCta from '../components/ServiceCta.jsx'
import FaqSection from '../components/FaqSection.jsx'
import './PluginDetail.css'

/** 帳票まわりのプラグインかどうか（有料メニューの出し分けに使う） */
function isReportPlugin(plugin) {
  if (!plugin) return false
  const target = `${plugin.slug ?? ''} ${plugin.name ?? ''}`
  return /帳票|form-output|report|pdf|PDF/.test(target)
}

/**
 * ビルド時にHTMLへ埋め込んだプラグイン情報を取り出す。
 * 書き込んでいるのは scripts/prerender.mjs です。
 *
 * これがあると、ページを開いた瞬間に本文を出せます（「読み込み中…」を挟まない）。
 * 静的HTMLに本文が入っているのに、Reactが起動した直後に空白へ戻ってしまうと
 * かえって見づらくなるため、最初の表示はこの値を使います。
 * そのあと下の useEffect がDBの最新値で置き換えます。
 */
function readPrerendered(slug) {
  if (typeof window === 'undefined') return null
  const data = window.__PRERENDERED_PLUGIN__
  if (!data || data.slug !== slug) return null
  return withNormalizedCategory(data)
}

export default function PluginDetail() {
  const { slug } = useParams()
  const [plugin, setPlugin] = useState(() => readPrerendered(slug))
  const [related, setRelated] = useState([])
  const [iconUrl, setIconUrl] = useState(null)
  const [state, setState] = useState(() => {
    if (readPrerendered(slug)) return 'done'
    return isConfigured ? 'loading' : 'idle'
  })
  const [downloading, setDownloading] = useState(false)

  // 構造化データ。中身は src/lib/plugin-meta.js にまとめてあり、
  // ビルド時の静的HTML（scripts/prerender.mjs）とまったく同じものになります。
  const jsonLd = useMemo(() => (plugin ? pluginJsonLd(plugin) : null), [plugin])

  // 検索結果に出るタイトル・説明文・canonical をプラグインごとに変える。
  // これをしないと36ページすべてが同じ扱いになり、検索で拾われません。
  usePageMeta({
    title: plugin ? pluginPageTitle(plugin) : undefined,
    description: plugin ? pluginPageDescription(plugin) : undefined,
    path: pluginPath(slug),
    jsonLd,
  })

  useEffect(() => {
    if (!isConfigured) return
    let cancelled = false

    // 埋め込み済みの内容があれば、それを出したまま裏で最新を取りに行く。
    const seeded = readPrerendered(slug)
    setPlugin(seeded)
    setState(seeded ? 'done' : 'loading')

    ;(async () => {
      try {
        const found = await getPluginBySlug(slug)
        if (cancelled) return
        if (!found || !found.published) {
          // DBに無い・非公開になった場合はDB側を正とする
          setState('notfound')
          return
        }
        setPlugin(withNormalizedCategory(found))
        setState('done')
        if (found.iconKey) {
          const url = await getFileUrl(found.iconKey).catch(() => null)
          if (!cancelled) setIconUrl(url)
        }
      } catch {
        // 通信に失敗しただけなら、埋め込み済みの内容を消さない
        if (!cancelled && !seeded) setState('error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [slug])

  // 関連プラグインは本文の表示より後でよいので、別の useEffect で後追いする。
  // 失敗しても関連欄が出ないだけで、ページ本体には影響させない。
  useEffect(() => {
    if (!isConfigured || !plugin) return
    let cancelled = false

    ;(async () => {
      try {
        const all = await listPublishedPlugins()
        if (cancelled) return
        const others = all
          .map((p) => ({ ...p, category: normalizeCategory(p.category) }))
          .filter((p) => p.id !== plugin.id)
        const sameCategory = others.filter((p) => p.category && p.category === plugin.category)
        const picked = [...sameCategory, ...others.filter((p) => !sameCategory.includes(p))]
        setRelated(picked.slice(0, 4))
      } catch {
        // 関連の取得失敗は無視する
      }
    })()

    return () => {
      cancelled = true
    }
  }, [plugin])

  const handleDownload = async () => {
    if (!plugin || downloading) return
    setDownloading(true)
    try {
      // 押した直後に使うだけなので短い有効期限で十分
      const url = await getFileUrl(plugin.zipKey, 300)
      countDownload(plugin.id) // 待たない。失敗してもDLは進める
      trackDownload({
        slug: plugin.slug,
        name: plugin.name,
        category: plugin.category,
        source: 'detail',
      })
      window.location.href = url
    } catch {
      alert('ダウンロードURLの取得に失敗しました。時間をおいて再度お試しください。')
    } finally {
      setDownloading(false)
    }
  }

  if (state === 'loading') return <p className="status">読み込み中…</p>
  if (state === 'error') return <p className="status status--error">読み込みに失敗しました。</p>
  if (state === 'notfound')
    return (
      <div className="status">
        <p>プラグインが見つかりませんでした。</p>
        <Link to="/">一覧に戻る</Link>
      </div>
    )
  if (!plugin) return null

  return (
    <article className="detail">
      {/* パンくず。検索エンジンにも利用者にも位置を伝える */}
      <nav className="detail__back" aria-label="パンくず">
        <Link to="/">← kintone 無料プラグイン一覧</Link>
        {plugin.category && <span className="detail__crumb">{plugin.category}</span>}
      </nav>

      <header className="detail__header">
        <div className="detail__icon">
          {iconUrl ? <img src={iconUrl} alt={`${plugin.name}のアイコン`} /> : <span aria-hidden="true">🧩</span>}
        </div>
        <div>
          <h1>{plugin.name}</h1>
          {plugin.nameEn && <p className="detail__subtitle">{plugin.nameEn}</p>}
          <p className="detail__summary">{plugin.summary}</p>
        </div>
      </header>

      <div className="detail__actions">
        <button type="button" className="button" onClick={handleDownload} disabled={downloading}>
          {downloading ? '準備中…' : 'ダウンロード（無料）'}
        </button>
        <dl className="detail__facts">
          <div>
            <dt>バージョン</dt>
            <dd>v{plugin.version}</dd>
          </div>
          {plugin.zipSize ? (
            <div>
              <dt>サイズ</dt>
              <dd>{formatBytes(plugin.zipSize)}</dd>
            </div>
          ) : null}
          {plugin.category && (
            <div>
              <dt>カテゴリ</dt>
              <dd>{plugin.category}</dd>
            </div>
          )}
          {plugin.releasedAt && (
            <div>
              <dt>公開日</dt>
              <dd>{formatDate(plugin.releasedAt)}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* 押す前の不安（お金がかかる？登録が必要？仕事で使える？）をここで消す */}
      <ul className="detail__badges">
        <li>無料</li>
        <li>会員登録不要</li>
        <li>商用利用可</li>
        <li>利用期限なし</li>
      </ul>

      {plugin.description && (
        <section className="detail__section">
          <h2>できること</h2>
          {plugin.description.split('\n').map((line, i) =>
            line.trim() ? <p key={i}>{line}</p> : null,
          )}
        </section>
      )}

      <UsageSection usage={normalizeUsage(plugin.usage)} />

      <section className="detail__section">
        <h2>導入方法</h2>
        <ol className="detail__steps">
          <li>上の「ダウンロード」ボタンで zip ファイルを保存します。</li>
          <li>
            kintone にログインし、右上の歯車から <strong>kintone システム管理</strong> →{' '}
            <strong>プラグイン</strong> を開きます。
          </li>
          <li>
            <strong>読み込む</strong> をクリックし、保存した zip ファイルを選択します。
          </li>
          <li>
            プラグインを使いたいアプリを開き、<strong>アプリの設定</strong> →{' '}
            <strong>プラグイン</strong> → <strong>追加する</strong> で選択します。
          </li>
          <li>歯車アイコンから設定を行い、アプリを更新すれば完了です。</li>
        </ol>
      </section>

      <ServiceCta variant="detail" reports={isReportPlugin(plugin)} pluginName={plugin.name} />

      {related.length > 0 && (
        <section className="detail__section">
          <h2>あわせて使えるプラグイン</h2>
          <ul className="detail__related">
            {related.map((p) => (
              <li key={p.id}>
                <Link to={`/plugins/${p.slug}`}>
                  <span className="detail__related-name">{p.name}</span>
                  <span className="detail__related-summary">{p.summary}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 押す前に残っている不安をここで消す。中身は src/lib/faq.js（36本共通） */}
      <FaqSection />

      <section className="detail__section detail__section--note">
        <h2>ご利用にあたって</h2>
        <p>
          本プラグインは無料で提供しているため、動作保証・対応期限の確約（SLA）はありません。
          ご利用によって生じた損害について、to.Morrow は責任を負いかねます。
          まずはテスト環境でお試しいただくことをおすすめします。
        </p>
        <p>
          再現手順のわかる不具合のご報告は無償で受け付けています（返信は週2回まとめてお返しします）。
          個別の設定代行・環境固有の調査・機能追加は有料メニューにて承ります。
        </p>
        <p>
          <a href={links.support} target="_blank" rel="noreferrer">
            無償サポートの範囲
          </a>
          {' ｜ '}
          <a href={links.terms} target="_blank" rel="noreferrer">
            利用規約
          </a>
          {' ｜ '}
          <a href={links.contact} target="_blank" rel="noreferrer">
            お問い合わせ
          </a>
        </p>
      </section>
    </article>
  )
}
