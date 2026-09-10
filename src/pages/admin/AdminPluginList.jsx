import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAllPlugins, deletePlugin, removeFile, updatePlugin } from '../../lib/api.js'
import { formatBytes } from '../../lib/format.js'

export default function AdminPluginList() {
  const [plugins, setPlugins] = useState([])
  const [state, setState] = useState('loading')
  const [error, setError] = useState(null)

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

  if (state === 'loading') return <p className="status">読み込み中…</p>
  if (state === 'error') return <p className="status status--error">{error}</p>

  return (
    <>
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

      {plugins.length === 0 ? (
        <p className="status">まだ登録がありません。「新規追加」から登録してください。</p>
      ) : (
        <div className="admin__tablewrap">
          <table className="admin__table">
            <thead>
              <tr>
                <th>公開</th>
                <th>順</th>
                <th>名前</th>
                <th>slug</th>
                <th>version</th>
                <th>サイズ</th>
                <th>DL数</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {plugins.map((p) => (
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
                  <td>{p.sortOrder}</td>
                  <td>{p.name}</td>
                  <td>
                    <code>{p.slug}</code>
                  </td>
                  <td>v{p.version}</td>
                  <td>{formatBytes(p.zipSize)}</td>
                  <td>{p.downloadCount ?? 0}</td>
                  <td className="admin__actions">
                    <Link to={`/admin/edit/${p.id}`}>編集</Link>
                    <button type="button" className="linklike danger" onClick={() => handleDelete(p)}>
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
