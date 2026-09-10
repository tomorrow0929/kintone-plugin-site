import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  createPlugin,
  updatePlugin,
  listAllPlugins,
  uploadFile,
  removeFile,
} from '../../lib/api.js'

const EMPTY = {
  slug: '',
  name: '',
  nameEn: '',
  summary: '',
  description: '',
  version: '1.0.0',
  category: '',
  published: false,
  sortOrder: 100,
  releasedAt: '',
}

// slug は URL に使うので、半角英数とハイフンだけに制限します
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

export default function AdminPluginForm({ mode }) {
  const { id } = useParams()
  const navigate = useNavigate()

  const [values, setValues] = useState(EMPTY)
  const [current, setCurrent] = useState(null) // 編集前の状態（既存ファイルのキー参照用）
  const [zipFile, setZipFile] = useState(null)
  const [iconFile, setIconFile] = useState(null)
  const [progress, setProgress] = useState(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [loadState, setLoadState] = useState(mode === 'edit' ? 'loading' : 'done')

  useEffect(() => {
    if (mode !== 'edit') return
    let cancelled = false

    ;(async () => {
      try {
        const all = await listAllPlugins()
        if (cancelled) return
        const found = all.find((p) => p.id === id)
        if (!found) {
          setLoadState('notfound')
          return
        }
        setCurrent(found)
        setValues({
          slug: found.slug ?? '',
          name: found.name ?? '',
          nameEn: found.nameEn ?? '',
          summary: found.summary ?? '',
          description: found.description ?? '',
          version: found.version ?? '',
          category: found.category ?? '',
          published: Boolean(found.published),
          sortOrder: found.sortOrder ?? 100,
          releasedAt: found.releasedAt ?? '',
        })
        setLoadState('done')
      } catch {
        if (!cancelled) setLoadState('error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [mode, id])

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setValues((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: null }))
  }

  const validate = () => {
    const next = {}
    if (!values.name.trim()) next.name = '名前を入力してください。'
    if (!values.summary.trim()) next.summary = '1行説明を入力してください。'
    if (!values.version.trim()) next.version = 'バージョンを入力してください。'
    if (!values.slug.trim()) {
      next.slug = 'slug を入力してください。'
    } else if (!SLUG_PATTERN.test(values.slug.trim())) {
      next.slug = '半角小文字の英数字とハイフンのみ使えます（例: bulk-copy）。'
    }
    if (mode === 'create' && !zipFile) next.zip = 'zip ファイルを選択してください。'
    if (zipFile && !zipFile.name.toLowerCase().endsWith('.zip')) {
      next.zip = '拡張子が .zip のファイルを選んでください。'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setSaving(true)
    setProgress(null)
    try {
      const slug = values.slug.trim()
      let zipKey = current?.zipKey ?? null
      let zipSize = current?.zipSize ?? null
      let iconKey = current?.iconKey ?? null

      if (zipFile) {
        const newKey = `plugins/${slug}/${Date.now()}-${sanitize(zipFile.name)}`
        await uploadFile(newKey, zipFile, setProgress)
        // 差し替えの場合は古いファイルを消す
        if (zipKey && zipKey !== newKey) await removeFile(zipKey)
        zipKey = newKey
        zipSize = zipFile.size
      }

      if (iconFile) {
        const newKey = `icons/${slug}/${Date.now()}-${sanitize(iconFile.name)}`
        await uploadFile(newKey, iconFile, setProgress)
        if (iconKey && iconKey !== newKey) await removeFile(iconKey)
        iconKey = newKey
      }

      const payload = {
        slug,
        name: values.name.trim(),
        nameEn: values.nameEn.trim() || null,
        summary: values.summary.trim(),
        description: values.description.trim() || null,
        version: values.version.trim(),
        category: values.category.trim() || null,
        published: values.published,
        sortOrder: Number(values.sortOrder) || 100,
        releasedAt: values.releasedAt || null,
        zipKey,
        zipSize,
        iconKey,
      }

      if (mode === 'create') {
        await createPlugin(payload)
      } else {
        await updatePlugin({ id, ...payload })
      }
      navigate('/admin')
    } catch (err) {
      alert(`保存に失敗しました\n${err.message}`)
    } finally {
      setSaving(false)
      setProgress(null)
    }
  }

  if (loadState === 'loading') return <p className="status">読み込み中…</p>
  if (loadState === 'error') return <p className="status status--error">読み込みに失敗しました。</p>
  if (loadState === 'notfound') return <p className="status">対象が見つかりませんでした。</p>

  return (
    <>
      <div className="admin__head">
        <h1>{mode === 'create' ? 'プラグインを追加' : 'プラグインを編集'}</h1>
        <Link to="/admin">← 一覧に戻る</Link>
      </div>

      <form className="admin__form" onSubmit={handleSubmit} noValidate>
        <Field label="名前" error={errors.name} required>
          <input value={values.name} onChange={set('name')} placeholder="一括コピープラグイン" />
        </Field>

        <Field label="英語名" hint="任意">
          <input value={values.nameEn} onChange={set('nameEn')} placeholder="Bulk Copy Plugin" />
        </Field>

        <Field
          label="slug（URLに使う識別子）"
          error={errors.slug}
          hint="半角小文字・数字・ハイフン。例: bulk-copy → /plugins/bulk-copy"
          required
        >
          <input value={values.slug} onChange={set('slug')} placeholder="bulk-copy" />
        </Field>

        <Field label="1行説明" error={errors.summary} hint="一覧に表示されます" required>
          <input
            value={values.summary}
            onChange={set('summary')}
            placeholder="一覧画面で選択した複数レコードを一括で複製します。"
          />
        </Field>

        <Field label="詳しい説明" hint="詳細ページに表示。改行で段落が分かれます">
          <textarea rows={7} value={values.description} onChange={set('description')} />
        </Field>

        <div className="admin__row">
          <Field label="バージョン" error={errors.version} required>
            <input value={values.version} onChange={set('version')} placeholder="1.0.0" />
          </Field>
          <Field label="カテゴリ" hint="任意。絞り込みに使われます">
            <input value={values.category} onChange={set('category')} placeholder="入力支援" />
          </Field>
          <Field label="並び順" hint="小さいほど上">
            <input type="number" value={values.sortOrder} onChange={set('sortOrder')} />
          </Field>
          <Field label="公開日" hint="任意">
            <input type="date" value={values.releasedAt} onChange={set('releasedAt')} />
          </Field>
        </div>

        <Field
          label="プラグイン本体（.zip）"
          error={errors.zip}
          hint={
            mode === 'edit'
              ? '差し替えるときだけ選択してください。選ばなければ現在のファイルのままです。'
              : '必須。kintone に読み込ませる zip ファイルです。'
          }
        >
          <input
            type="file"
            accept=".zip,application/zip"
            onChange={(e) => setZipFile(e.target.files?.[0] ?? null)}
          />
          {current?.zipKey && !zipFile && (
            <p className="admin__current">現在: {current.zipKey.split('/').pop()}</p>
          )}
        </Field>

        <Field label="アイコン画像" hint="任意。正方形のPNG推奨">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setIconFile(e.target.files?.[0] ?? null)}
          />
          {current?.iconKey && !iconFile && (
            <p className="admin__current">現在: {current.iconKey.split('/').pop()}</p>
          )}
        </Field>

        <label className="admin__check">
          <input type="checkbox" checked={values.published} onChange={set('published')} />
          <span>公開する（チェックを外すと下書き扱いで一般には見えません）</span>
        </label>

        {progress !== null && (
          <p className="admin__progress">アップロード中… {Math.round(progress * 100)}%</p>
        )}

        <div className="admin__submit">
          <button type="submit" className="button" disabled={saving}>
            {saving ? '保存中…' : '保存する'}
          </button>
          <Link to="/admin" className="button button--ghost">
            キャンセル
          </Link>
        </div>
      </form>
    </>
  )
}

function Field({ label, hint, error, required, children }) {
  return (
    <label className="admin__field">
      <span className="admin__label">
        {label}
        {required && <em className="admin__required">必須</em>}
      </span>
      {children}
      {hint && !error && <span className="admin__hint">{hint}</span>}
      {error && <span className="admin__error">{error}</span>}
    </label>
  )
}

/** S3のキーに使えない文字を置き換える */
function sanitize(filename) {
  return filename.replace(/[^\w.\-]/g, '_')
}
