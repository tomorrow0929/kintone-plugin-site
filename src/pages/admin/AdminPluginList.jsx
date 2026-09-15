import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAllPlugins, deletePlugin, removeFile, updatePlugin } from '../../lib/api.js'
import { formatBytes } from '../../lib/format.js'
import { normalizeUsage, isUsageEmpty } from '../../lib/usage.js'
import { normalizeCategory, CANONICAL_CATEGORIES } from '../../lib/category.js'

export default function AdminPluginList() {
  const [plugins, setPlugins] = useState([])
  const [state, setState] = useState('loading')
  const [error, setError] = useState(null)
  const [moving, setMoving] = useState(false)

  const load = async () => {
    setState('loading')
    try {
      setPlugins(await listAllPlugins())
      setState('done')
    } catch (e) {
      setError(e.message)
      setState('error')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const togglePublished = async (plugin) => {
    try {
      await updatePlugin({ id: plugin.id, published: !plugin.published })
      await load()
    } catch (e) {
      alert(`更新に失敗しました\n${e.message}`)
    }
  }

  /**
   * 行を1つ上（または下）に動かして、並び順を保存する。
   *
   * 【なぜ番号を振り直すのか】
   * 並び順が全件100のように重複していると、2件を入れ替えても順番が決まらない。
   * そこで、動かしたあとの表示順のとおりに 1,2,3… と振り直し、
   * 実際に値が変わったものだけを保存する。
   * 初回だけ全件の保存が走るが、2回目以降は動かした2件だけで済む。
   *
   * 公開サイトの並びもこの値で決まるので、押した時点で表示順が変わる
   * （反映にはビルドが要る。README の「SEO」を参照）。
   */
  const move = async (index, direction) => {
    const target = index + direction
    if (moving || target < 0 || target >= plugins.length) return

    const reordered = [...plugins]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]

    // 表示順のとおりに 1 から振り直す
    const renumbered = reordered.map((p, i) => ({ ...p, sortOrder: i + 1 }))
    const changed = renumbered.filter(
      (p) => p.sortOrder !== plugins.find((o) => o.id === p.id)?.sortOrder,
    )

    // 先に画面を動かす。待たされている感じを出さないため
    setPlugins(renumbered)
    setMoving(true)
    try {
      await Promise.all(changed.map((p) => updatePlugin({ id: p.id, sortOrder: p.sortOrder })))
    } catch (e) {
      alert(`並び順の保存に失敗しました\n${e.message}`)
      await load() // 画面とDBがずれたままにしない
    } finally {
      setMoving(false)
    }
  }

  const handleDelete = async (plugin) => {
    const ok = window.confirm(
      `「${plugin.name}」を削除します。\n` +
        'アップロード済みの zip とアイコンも一緒に削除され、元に戻せません。\n\n' +
        '本当に削除しますか？',
    )
    if (!ok) return
    try {
      await removeFile(plugin.zipKey)
      await removeFile(plugin.iconKey)
      await deletePlugin(plugin.id)
      await load()
    } catch (e) {
      alert(`削除に失敗しました\n${e.message}`)
    }
  }

  // 並び順が重複している＝まだ番号を振っていない状態。↑↓ を押せば直る
  const hasDuplicateOrder =
    plugins.length > 1 && new Set(plugins.map((p) => p.sortOrder)).size < plugins.length

  return (
    <>
      {/* 一覧の読み込みに失敗しても操作ボタンは出す。
          データが読めないと登録もできない、という詰まり方を防ぐため。 */}
      <div className="admin__head">
        <h1>プラグイン管理</h1>
        <div className="admin__actions">
          <Link to="/admin/import" className="button button--ghost">
            zip をまとめて取り込む
          </Link>
          <Link to="/admin/new" className="button">
            + 新規追加
          </Link>
        </div>
      </div>

      {state === 'loading' && <p className="status">読み込み中…</p>}

      {state === 'error' && (
        <p className="status status--error">
          一覧の読み込みに失敗しました。
          <br />
          <small>{error}</small>
          <br />
          <button type="button" className="linklike" onClick={load}>
            再読み込み
          </button>
        </p>
      )}

      {state === 'done' &&
        (plugins.length === 0 ? (
          <p className="status">まだ登録がありません。「新規追加」から登録してください。</p>
        ) : (
          <>
            <p className="admin__note">
              並び順を変えるのは<strong>この画面の ↑↓ だけ</strong>です（登録画面に番号の入力欄はありません）。
              動かすと<strong>公開サイトの表示順も変わります</strong>。新しく登録したものは一番下に入ります。
              <br />
              変更を実際のページに反映するには、Amplify から再デプロイしてください。
              {hasDuplicateOrder && (
                <>
                  <br />
                  いまは同じ番号が重複しています。一度 ↑↓ を押すと、
                  そのときの表示順のとおりに 1 から振り直されます。
                </>
              )}
            </p>

            <div className="admin__tablewrap">
              <table className="admin__table">
                <thead>
                  <tr>
                    <th>公開</th>
                    <th>順</th>
                    <th>名前</th>
                    <th>カテゴリ</th>
                    <th>slug</th>
                    <th>version</th>
                    <th>サイズ</th>
                    <th>DL数</th>
                    <th>使い方</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {plugins.map((p, i) => {
                    // 表記ゆれを見つけるのが目的なので、正規化せず「入っている値そのもの」で判定する
                    const category = (p.category ?? '').trim()
                    const isStray = Boolean(category) && !CANONICAL_CATEGORIES.includes(category)
                    return (
                      <tr key={p.id} className={p.published ? '' : 'is-draft'}>
                        <td>
                          <button
                            type="button"
                            className={`pill ${p.published ? 'pill--on' : 'pill--off'}`}
                            onClick={() => togglePublished(p)}
                          >
                            {p.published ? '公開中' : '非公開'}
                          </button>
                        </td>
                        <td>
                          <div className="admin__order">
                            <span className="admin__ordernum">{p.sortOrder}</span>
                            <button
                              type="button"
                              className="admin__movebtn"
                              onClick={() => move(i, -1)}
                              disabled={moving || i === 0}
                              aria-label={`${p.name}を上へ`}
                              title="上へ"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="admin__movebtn"
                              onClick={() => move(i, 1)}
                              disabled={moving || i === plugins.length - 1}
                              aria-label={`${p.name}を下へ`}
                              title="下へ"
                            >
                              ↓
                            </button>
                          </div>
                        </td>
                        <td>{p.name}</td>
                        <td>
                          {category ? (
                            <span
                              className={`tag${isStray ? ' tag--stray' : ''}`}
                              title={
                                isStray
                                  ? `正式な表記は「${normalizeCategory(category)}」です`
                                  : undefined
                              }
                            >
                              {category}
                            </span>
                          ) : (
                            <span className="admin__empty">未設定</span>
                          )}
                        </td>
                        <td>
                          <code>{p.slug}</code>
                        </td>
                        <td>v{p.version}</td>
                        <td>{formatBytes(p.zipSize)}</td>
                        <td>{p.downloadCount ?? 0}</td>
                        <td>
                          <Link to={`/admin/usage/${p.id}`}>
                            {isUsageEmpty(normalizeUsage(p.usage)) ? '未記入' : '編集'}
                          </Link>
                        </td>
                        <td className="admin__actions">
                          <Link to={`/admin/edit/${p.id}`}>編集</Link>
                          <button
                            type="button"
                            className="linklike danger"
                            onClick={() => handleDelete(p)}
                          >
                            削除
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        ))}
    </>
  )
}
