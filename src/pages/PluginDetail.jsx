import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getPluginBySlug, getFileUrl } from '../lib/api.js'
import { isConfigured } from '../lib/amplify.js'
import { formatBytes, formatDate } from '../lib/format.js'
import './PluginDetail.css'

export default function PluginDetail() {
  const { slug } = useParams()
  const [plugin, setPlugin] = useState(null)
  const [iconUrl, setIconUrl] = useState(null)
  const [state, setState] = useState(isConfigured ? 'loading' : 'idle')
  const [downloading, setDownloading] = useState(false)

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
        setPlugin(found)
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

  const handleDownload = async () => {
    if (!plugin || downloading) return
    setDownloading(true)
    try {
      const url = await getFileUrl(plugin.zipKey)
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

      {plugin.description && (
        <section className="detail__section">
          <h2>できること</h2>
          {plugin.description.split('\n').map((line, i) =>
            line.trim() ? <p key={i}>{line}</p> : null,
          )}
        </section>
      )}

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

      <section className="detail__section detail__section--note">
        <h2>ご利用にあたって</h2>
        <p>
          本プラグインは無料で提供していますが、動作を保証するものではありません。
          ご利用によって生じた損害について、to.Morrow は責任を負いかねます。
          まずはテスト環境でお試しいただくことをおすすめします。
        </p>
        <p>
          不具合のご報告・改修のご依頼は{' '}
          <a href="https://main.d3k8o4bbbbo4ke.amplifyapp.com/#contact">お問い合わせ</a>{' '}
          からご連絡ください。
        </p>
      </section>
    </article>
  )
}
