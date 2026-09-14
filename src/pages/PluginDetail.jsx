import { useEffect, useState } from 'react'
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
import { normalizeCategory } from '../lib/category.js'
import { usePageMeta } from '../lib/meta.js'
import { trackDownload } from '../lib/analytics.js'
import { links } from '../lib/site.js'
import UsageSection from '../components/UsageSection.jsx'
import ServiceCta from '../components/ServiceCta.jsx'
import './PluginDetail.css'

/** 帳票まわりのプラグインかどうか（有料メニューの出し分けに使う） */
function isReportPlugin(plugin) {
  if (!plugin) return false
  const target = `${plugin.slug ?? ''} ${plugin.name ?? ''}`
  return /帳票|form-output|report|pdf|PDF/.test(target)
}

export default function PluginDetail() {
  const { slug } = useParams()
  const [plugin, setPlugin] = useState(null)
  const [related, setRelated] = useState([])
  const [iconUrl, setIconUrl] = useState(null)
  const [state, setState] = useState(isConfigured ? 'loading' : 'idle')
  const [downloading, setDownloading] = useState(false)

  // 検索結果に出るタイトル・説明文をプラグインごとに変える。
  // これをしないと36ページすべてが同じタイトルになり、検索で拾われません。
  usePageMeta(
    plugin ? `${plugin.name}（無料）| kintoneプラグイン | to.Morrow` : null,
    plugin ? `${plugin.summary ?? ''} 無料・会員登録不要でダウンロードできます。` : null,
  )

  useEffect(() => {
    if (!isConfigured) return
    let cancelled = false
    setState('loading')

    ;(async () => {
      try {
        const found = await getPluginBySlug(slug)
        if (cancelled) return
        if (!found || !found.published) {
          setState('notfound')
          return
        }
        setPlugin({ ...found, category: normalizeCategory(found.category) })
        setState('done')
        if (found.iconKey) {
          const url = await getFileUrl(found.iconKey).catch(() => null)
          if (!cancelled) setIconUrl(url)
        }
      } catch {
        if (!cancelled) setState('error')
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
      <p className="detail__back">
        <Link to="/">← プラグイン一覧</Link>
      </p>

      <header className="detail__header">
        <div className="detail__icon">
          {iconUrl ? <img src={iconUrl} alt="" /> : <span aria-hidden="true">🧩</span>}
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
