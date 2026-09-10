import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  listAllPlugins,
  updatePlugin,
  uploadFile,
  removeFile,
  getFileUrl,
} from '../../lib/api.js'
import {
  normalizeUsage,
  createStep,
  serializeUsage,
  toStoredUsage,
  collectImageKeys,
  EMPTY_USAGE,
} from '../../lib/usage.js'
import './AdminUsageEditor.css'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/**
 * 使い方の編集画面。
 *
 * 手順を並べて、それぞれに説明文と画像1枚を付けられる。
 * 画像は選んだ時点で S3 に上げ、キーだけを持つ。
 */
export default function AdminUsageEditor() {
  const { id } = useParams()

  const [plugin, setPlugin] = useState(null)
  const [usage, setUsage] = useState(EMPTY_USAGE)
  const [previews, setPreviews] = useState({}) // { imageKey: 表示用URL }
  const [uploading, setUploading] = useState(null) // アップロード中の手順ID
  const [saving, setSaving] = useState(false)
  const [state, setState] = useState('loading')
  const [message, setMessage] = useState(null)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const all = await listAllPlugins()
        if (cancelled) return
        const found = all.find((p) => p.id === id)
        if (!found) {
          setState('notfound')
          return
        }
        const loaded = normalizeUsage(found.usage)
        setPlugin(found)
        setUsage(loaded)
        setState('done')

        // 既に付いている画像の表示用URLを用意する
        for (const key of collectImageKeys(loaded)) {
          getFileUrl(key)
            .then((url) => {
              if (!cancelled && url) setPreviews((prev) => ({ ...prev, [key]: url }))
            })
            .catch(() => {})
        }
      } catch (e) {
        if (!cancelled) {
          setMessage({ type: 'error', text: e.message })
          setState('error')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [id])

  const patchStep = (stepId, patch) =>
    setUsage((prev) => ({
      ...prev,
      steps: prev.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)),
    }))

  const addStep = () =>
    setUsage((prev) => ({ ...prev, steps: [...prev.steps, createStep()] }))

  const moveStep = (index, direction) => {
    const target = index + direction
    setUsage((prev) => {
      if (target < 0 || target >= prev.steps.length) return prev
      const steps = [...prev.steps]
      ;[steps[index], steps[target]] = [steps[target], steps[index]]
      return { ...prev, steps }
    })
  }

  const removeStep = (step) => {
    if (!window.confirm('この手順を削除します。よろしいですか？')) return
    // 画像はここでは消さない。保存時に「使われなくなったもの」をまとめて消す
    setUsage((prev) => ({ ...prev, steps: prev.steps.filter((s) => s.id !== step.id) }))
  }

  const handleImage = async (step, file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: '画像ファイルを選んでください。' })
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setMessage({
        type: 'error',
        text: `画像が大きすぎます（${(file.size / 1024 / 1024).toFixed(1)}MB）。5MB以下にしてください。`,
      })
      return
    }

    setUploading(step.id)
    setMessage(null)
    try {
      const key = `usage/${plugin.slug}/${Date.now()}-${sanitize(file.name)}`
      await uploadFile(key, file)
      patchStep(step.id, { imageKey: key })
      const url = await getFileUrl(key)
      if (url) setPreviews((prev) => ({ ...prev, [key]: url }))
    } catch (e) {
      setMessage({ type: 'error', text: `画像のアップロードに失敗しました（${e.message}）` })
    } finally {
      setUploading(null)
    }
  }

  const clearImage = (step) => patchStep(step.id, { imageKey: null, imageCaption: '' })

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const payload = serializeUsage(usage)

      // 使われなくなった画像を S3 から消す（残しておくと料金と管理の無駄）
      const before = collectImageKeys(normalizeUsage(plugin.usage))
      const after = new Set(collectImageKeys(payload))
      for (const key of before) {
        if (!after.has(key)) await removeFile(key)
      }

      // AWSJSON はJSON文字列しか受け付けないので、必ず文字列にして渡す
      const stored = toStoredUsage(usage)
      const saved = await updatePlugin({ id, usage: stored })

      // 次に保存するときの「変更前」として使うので、
      // DBから返ってくるのと同じ形（文字列）で持っておく
      setPlugin(saved ?? { ...plugin, usage: stored })
      setUsage(normalizeUsage(stored))
      setMessage({ type: 'success', text: '保存しました。' })
    } catch (e) {
      setMessage({ type: 'error', text: `保存に失敗しました（${e.message}）` })
    } finally {
      setSaving(false)
    }
  }

  if (state === 'loading') return <p className="status">読み込み中…</p>
  if (state === 'error') return <p className="status status--error">{message?.text}</p>
  if (state === 'notfound') return <p className="status">対象が見つかりませんでした。</p>

  return (
    <>
      <div className="admin__head">
        <h1>使い方を編集 — {plugin.name}</h1>
        <Link to="/admin">← 一覧に戻る</Link>
      </div>

      <p className="admin__hint">
        入力した内容は、公開ページの「使い方」として表示されます。
        中身が空のうちは「使い方」の見出しごと出ません。
        書き終わったら詳細ページ（
        <a href={`/plugins/${plugin.slug}`} target="_blank" rel="noreferrer">
          /plugins/{plugin.slug}
        </a>
        ）で見た目を確認してください。
      </p>

      <div className="usage-editor">
        <label className="admin__field">
          <span className="admin__label">導入文</span>
          <textarea
            rows={3}
            value={usage.intro}
            placeholder="このプラグインで何ができるか、どんな場面で使うかを短く。"
            onChange={(e) => setUsage((prev) => ({ ...prev, intro: e.target.value }))}
          />
          <span className="admin__hint">手順の前に表示されます。空でも構いません。</span>
        </label>

        <h2 className="usage-editor__heading">手順</h2>

        {usage.steps.length === 0 && (
          <p className="admin__hint">
            まだ手順がありません。「手順を追加」から作成してください。
          </p>
        )}

        {usage.steps.map((step, index) => (
          <section className="usage-step" key={step.id}>
            <header className="usage-step__bar">
              <span className="usage-step__num">{index + 1}</span>
              <div className="usage-step__tools">
                <button
                  type="button"
                  className="linklike"
                  onClick={() => moveStep(index, -1)}
                  disabled={index === 0}
                >
                  ↑ 上へ
                </button>
                <button
                  type="button"
                  className="linklike"
                  onClick={() => moveStep(index, 1)}
                  disabled={index === usage.steps.length - 1}
                >
                  ↓ 下へ
                </button>
                <button
                  type="button"
                  className="linklike danger"
                  onClick={() => removeStep(step)}
                >
                  削除
                </button>
              </div>
            </header>

            <label className="admin__field">
              <span className="admin__label">見出し</span>
              <input
                value={step.title}
                placeholder="例: アプリの設定画面を開く"
                onChange={(e) => patchStep(step.id, { title: e.target.value })}
              />
            </label>

            <label className="admin__field">
              <span className="admin__label">説明</span>
              <textarea
                rows={4}
                value={step.body}
                placeholder="操作の内容を書きます。改行するとそのまま改行されます。"
                onChange={(e) => patchStep(step.id, { body: e.target.value })}
              />
            </label>

            <div className="admin__field">
              <span className="admin__label">画像（任意・1枚まで・5MBまで）</span>

              {step.imageKey ? (
                <div className="usage-step__image">
                  {previews[step.imageKey] ? (
                    <img src={previews[step.imageKey]} alt="" />
                  ) : (
                    <p className="admin__hint">画像を読み込み中…</p>
                  )}
                  <div className="usage-step__imagetools">
                    <button type="button" className="linklike danger" onClick={() => clearImage(step)}>
                      画像を外す
                    </button>
                  </div>
                  <input
                    className="usage-step__caption"
                    value={step.imageCaption}
                    placeholder="画像の説明（任意）"
                    onChange={(e) => patchStep(step.id, { imageCaption: e.target.value })}
                  />
                </div>
              ) : (
                <>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploading === step.id}
                    onChange={(e) => handleImage(step, e.target.files?.[0] ?? null)}
                  />
                  {uploading === step.id && (
                    <span className="admin__progress">アップロード中…</span>
                  )}
                  <span className="admin__hint">
                    設定画面のスクリーンショットや図を入れると分かりやすくなります。
                  </span>
                </>
              )}
            </div>
          </section>
        ))}

        <button type="button" className="button button--ghost" onClick={addStep}>
          + 手順を追加
        </button>

        <label className="admin__field">
          <span className="admin__label">注意点</span>
          <textarea
            rows={3}
            value={usage.notes}
            placeholder="つまずきやすい点、制限、前提条件など。"
            onChange={(e) => setUsage((prev) => ({ ...prev, notes: e.target.value }))}
          />
          <span className="admin__hint">手順のあとに、目立つ枠で表示されます。</span>
        </label>

        <div className="admin__submit">
          <button type="button" className="button" onClick={handleSave} disabled={saving}>
            {saving ? '保存中…' : '保存する'}
          </button>
          <Link to="/admin" className="button button--ghost">
            一覧に戻る
          </Link>
          {message && (
            <span className={message.type === 'error' ? 'admin__error' : 'usage-editor__ok'}>
              {message.text}
            </span>
          )}
        </div>
      </div>
    </>
  )
}

function sanitize(filename) {
  return filename.replace(/[^\w.\-]/g, '_')
}
