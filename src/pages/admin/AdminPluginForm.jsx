import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  createPlugin,
  updatePlugin,
  listAllPlugins,
  uploadFile,
  removeFile,
  nextSortOrder,
} from '../../lib/api.js'
import { CANONICAL_CATEGORIES, normalizeCategory } from '../../lib/category.js'

const EMPTY = {
  slug: '',
  name: '',
  nameEn: '',
  summary: '',
  description: '',
  version: '1.0.0',
  category: '',
  published: false,
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

  /**
   * 現在DBに入っているカテゴリと、その本数。
   * カテゴリ欄は自由記述のままにしておきたいが、それだけだと
   * 「データ連携・インポート」と「〜系」のような打ち間違いが混ざる。
   * 入力欄の下に実在する選択肢を出して、押すだけで入れられるようにする。
   */
  const [usedCategories, setUsedCategories] = useState([])

  /**
   * 新規登録したときに入れる並び順（＝いまの最大値＋1）。
   * 並び順は手で入れさせず、新しいものは必ず一番最後に置く。
   * 順番を変えたいときは一覧の ↑↓ で行う。
   */
  const [newSortOrder, setNewSortOrder] = useState(1)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const all = await listAllPlugins()
        if (cancelled) return

        // カテゴリ別の本数を数える（非公開も含める。直す対象だから）
        const counts = new Map()
        for (const plugin of all) {
          const value = (plugin.category ?? '').trim()
          if (!value) continue
          counts.set(value, (counts.get(value) ?? 0) + 1)
        }
        setUsedCategories(
          [...counts.entries()]
            .map(([value, count]) => ({ value, count }))
            .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'ja')),
        )
        setNewSortOrder(nextSortOrder(all))

        if (mode !== 'edit') return
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
        // 新規は一番最後に置く。編集では並び順に触らない（一覧の ↑↓ が持ち場）
        ...(mode === 'create' ? { sortOrder: newSortOrder } : {}),
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

        {/* カテゴリは選択肢を下に並べるので、他の項目と横並びにせず単独で置く */}
        <Field
          label="カテゴリ"
          hint="任意。一覧の絞り込みとカテゴリページ（/category/…）に使われます"
          after={
            <CategoryOptions
              used={usedCategories}
              value={values.category}
              onPick={(name) => setValues((prev) => ({ ...prev, category: name }))}
            />
          }
        >
          <input value={values.category} onChange={set('category')} placeholder="表示・UI改善系" />
        </Field>

        <div className="admin__row">
          <Field label="バージョン" error={errors.version} required>
            <input value={values.version} onChange={set('version')} placeholder="1.0.0" />
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

/**
 * after は <label> の外に置く。
 * ボタンを label の中に入れると、押したときに入力欄のフォーカスまで動いて
 * 挙動が分かりにくくなるため。
 */
function Field({ label, hint, error, required, children, after }) {
  return (
    <div className="admin__fieldwrap">
      <label className="admin__field">
        <span className="admin__label">
          {label}
          {required && <em className="admin__required">必須</em>}
        </span>
        {children}
        {hint && !error && <span className="admin__hint">{hint}</span>}
        {error && <span className="admin__error">{error}</span>}
      </label>
      {after}
    </div>
  )
}

/**
 * カテゴリ欄の下に出す選択肢。
 *
 * 自由記述は残したまま、押すだけで正式な表記が入るようにする。
 * 正式な5つ（src/lib/category.js の CANONICAL_CATEGORIES）を先に並べ、
 * そのあとに「DBに入っているが正式ではない表記」を分けて出す。
 * 後者が見えていれば、直す対象がその場で分かる。
 */
function CategoryOptions({ used, value, onPick }) {
  const current = value.trim()
  const canonical = new Set(CANONICAL_CATEGORIES)

  // DBにあるが正式ではないもの（表記ゆれ・古いカテゴリ）
  const strays = used.filter((c) => !canonical.has(c.value))

  // 正式なものの本数（DBに1本も無いものは0と出す）
  const countOf = (name) => used.find((c) => c.value === name)?.count ?? 0

  const isStray = current !== '' && !canonical.has(current)

  return (
    <div className="admin__catopts">
      <span className="admin__catlabel">正式なカテゴリ（押すと入ります）</span>
      <div className="admin__cats">
        {CANONICAL_CATEGORIES.map((name) => (
          <button
            key={name}
            type="button"
            className={`admin__cat${current === name ? ' is-active' : ''}`}
            onClick={() => onPick(name)}
          >
            {name}
            <em>{countOf(name)}</em>
          </button>
        ))}
      </div>

      {strays.length > 0 && (
        <>
          <span className="admin__catlabel admin__catlabel--warn">
            正式ではない表記（この表記のプラグインは直す対象です）
          </span>
          <div className="admin__cats">
            {strays.map((c) => (
              <button
                key={c.value}
                type="button"
                className={`admin__cat admin__cat--stray${
                  current === c.value ? ' is-active' : ''
                }`}
                onClick={() => onPick(normalizeCategory(c.value))}
                title={`押すと「${normalizeCategory(c.value)}」が入ります`}
              >
                {c.value}
                <em>{c.count}</em>
              </button>
            ))}
          </div>
        </>
      )}

      {isStray && (
        <span className="admin__caterror">
          「{current}」は正式なカテゴリではありません。
          {canonical.has(normalizeCategory(current))
            ? `「${normalizeCategory(current)}」が正しい表記です。`
            : '上のボタンから選ぶか、表記を確認してください。'}
        </span>
      )}
    </div>
  )
}

/** S3のキーに使えない文字を置き換える */
function sanitize(filename) {
  return filename.replace(/[^\w.\-]/g, '_')
}
