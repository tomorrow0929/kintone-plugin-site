import { useEffect, useState } from 'react'
import { getFileUrlMap } from '../lib/api.js'
import { collectImageKeys, isUsageEmpty } from '../lib/usage.js'
import './UsageSection.css'

/**
 * プラグイン詳細ページの「使い方」。
 * 中身が空なら何も描画しない（見出しごと出さない）。
 */
export default function UsageSection({ usage }) {
  const [images, setImages] = useState({})
  const [zoomed, setZoomed] = useState(null)

  const keys = collectImageKeys(usage)

  useEffect(() => {
    if (keys.length === 0) return
    let cancelled = false
    getFileUrlMap(keys)
      .then((map) => {
        if (!cancelled) setImages(map)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // キーの並びが変わったときだけ取り直す
  }, [keys.join('|')])

  // 拡大表示中は Esc で閉じられるようにする
  useEffect(() => {
    if (!zoomed) return
    const onKey = (e) => {
      if (e.key === 'Escape') setZoomed(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoomed])

  if (isUsageEmpty(usage)) return null

  return (
    <section className="usage" id="usage">
      <h2>使い方</h2>

      {usage.intro && <p className="usage__intro">{usage.intro}</p>}

      {usage.steps.length > 0 && (
        <ol className="usage__steps">
          {usage.steps.map((step) => (
            <li className="usage__step" key={step.id}>
              <div className="usage__stepbody">
                {step.title && <h3>{step.title}</h3>}
                {step.body &&
                  step.body
                    .split('\n')
                    .map((line, i) => (line.trim() ? <p key={i}>{line}</p> : null))}
              </div>

              {step.imageKey && images[step.imageKey] && (
                <figure className="usage__figure">
                  <button
                    type="button"
                    className="usage__zoom"
                    onClick={() =>
                      setZoomed({ url: images[step.imageKey], caption: step.imageCaption })
                    }
                    aria-label="画像を拡大する"
                  >
                    <img src={images[step.imageKey]} alt={step.imageCaption || ''} loading="lazy" />
                  </button>
                  {step.imageCaption && <figcaption>{step.imageCaption}</figcaption>}
                </figure>
              )}
            </li>
          ))}
        </ol>
      )}

      {usage.notes && (
        <div className="usage__notes">
          <h3>注意点</h3>
          {usage.notes.split('\n').map((line, i) => (line.trim() ? <p key={i}>{line}</p> : null))}
        </div>
      )}

      {zoomed && (
        <div
          className="usage__lightbox"
          role="dialog"
          aria-modal="true"
          onClick={() => setZoomed(null)}
        >
          <button type="button" className="usage__close" aria-label="閉じる">
            ×
          </button>
          <img src={zoomed.url} alt={zoomed.caption || ''} onClick={(e) => e.stopPropagation()} />
          {zoomed.caption && <p className="usage__lightboxcaption">{zoomed.caption}</p>}
        </div>
      )}
    </section>
  )
}
