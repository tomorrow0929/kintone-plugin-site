import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { readPluginZip } from '../../lib/readPluginZip.js'
import { createPlugin, listAllPlugins, uploadFile } from '../../lib/api.js'
import { formatBytes } from '../../lib/format.js'

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

/**
 * 複数の zip をまとめて登録する画面。
 * zip の中の manifest.json から名前・説明・バージョンを自動で読み取ります。
 */
export default function AdminBulkImport() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [reading, setReading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [log, setLog] = useState([])

  const handleFiles = async (event) => {
    const files = [...(event.target.files ?? [])].filter((f) => f.name.toLowerCase().endsWith('.zip'))
    if (files.length === 0) return

    setReading(true)
    setLog([])
    const existing = await listAllPlugins().catch(() => [])
    const usedSlugs = new Set(existing.map((p) => p.slug))

    const parsed = []
    for (const file of files) {
      try {
        const info = await readPluginZip(file)
        let slug = info.slug
        // slug が重複したら末尾に番号を足す
        if (slug && usedSlugs.has(slug)) {
          let n = 2
          while (usedSlugs.has(`${slug}-${n}`)) n += 1
          slug = `${slug}-${n}`
        }
        if (slug) usedSlugs.add(slug)

        parsed.push({
          key: `${file.name}-${file.size}`,
          file,
          iconFile: info.iconFile,
          name: info.name,
          nameEn: info.nameEn,
          summary: info.summary,
          description: info.description,
          version: info.version,
          slug,
          category: '',
          selected: true,
          error: null,
        })
      } catch (e) {
        parsed.push({
          key: `${file.name}-${file.size}`,
          file,
          name: file.name,
          selected: false,
          error: e.message,
        })
      }
    }

    setRows(parsed)
    setReading(false)
    event.target.value = '' // 同じファイルを選び直せるようにする
  }

  const updateRow = (key, patch) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const targets = rows.filter((r) => r.selected && !r.error)
  const invalid = targets.filter((r) => !SLUG_PATTERN.test(r.slug ?? ''))

  const handleImport = async () => {
    if (targets.length === 0 || invalid.length > 0 || importing) return
    setImporting(true)
    const messages = []

    for (const row of targets) {
      try {
        const zipKey = `plugins/${row.slug}/${Date.now()}-${sanitize(row.file.name)}`
        await uploadFile(zipKey, row.file)

        let iconKey = null
        if (row.iconFile) {
          iconKey = `icons/${row.slug}/${Date.now()}-${sanitize(row.iconFile.name)}`
          await uploadFile(iconKey, row.iconFile)
        }

        await createPlugin({
          slug: row.slug,
          name: row.name,
          nameEn: row.nameEn || null,
          summary: row.summary || row.name,
          description: row.description || null,
          version: row.version || '1.0.0',
          category: row.category.trim() || null,
          zipKey,
          zipSize: row.file.size,
          iconKey,
          // 内容を確認してから公開してほしいので、最初は非公開で登録します
          published: false,
          sortOrder: 100,
        })
        messages.push(`✅ ${row.name}`)
      } catch (e) {
        messages.push(`❌ ${row.name} — ${e.message}`)
      }
      setLog([...messages])
    }

    setImporting(false)
  }

  return (
    <>
      <div className="admin__head">
        <h1>zip をまとめて取り込む</h1>
        <Link to="/admin">← 一覧に戻る</Link>
      </div>

      <div className="admin__form">
        <p className="admin__hint">
          プラグインの zip を複数まとめて選択すると、中の <code>manifest.json</code> から
          名前・説明・バージョン・アイコンを自動で読み取ります。
          <strong>取り込んだ直後は「非公開」</strong>なので、内容を確認してから公開してください。
        </p>

        <input type="file" accept=".zip" multiple onChange={handleFiles} disabled={reading || importing} />
        {reading && <p className="admin__progress">zip を読み込み中…</p>}

        {rows.length > 0 && (
          <>
            <div className="admin__tablewrap">
              <table className="admin__table">
                <thead>
                  <tr>
                    <th>取込</th>
                    <th>ファイル</th>
                    <th>名前</th>
                    <th>slug（URLに使用）</th>
                    <th>カテゴリ</th>
                    <th>ver</th>
                    <th>サイズ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key} className={row.error ? 'is-draft' : ''}>
                      <td>
                        <input
                          type="checkbox"
                          checked={row.selected}
                          disabled={Boolean(row.error)}
                          onChange={(e) => updateRow(row.key, { selected: e.target.checked })}
                        />
                      </td>
                      <td>
                        {row.file.name}
                        {row.error && <div className="admin__error">{row.error}</div>}
                      </td>
                      <td>
                        {row.error ? (
                          '—'
                        ) : (
                          <input
                            value={row.name}
                            onChange={(e) => updateRow(row.key, { name: e.target.value })}
                          />
                        )}
                      </td>
                      <td>
                        {row.error ? (
                          '—'
                        ) : (
                          <>
                            <input
                              value={row.slug}
                              placeholder="bulk-copy"
                              onChange={(e) => updateRow(row.key, { slug: e.target.value })}
                            />
                            {row.selected && !SLUG_PATTERN.test(row.slug ?? '') && (
                              <div className="admin__error">半角小文字・数字・ハイフンで入力</div>
                            )}
                          </>
                        )}
                      </td>
                      <td>
                        {row.error ? (
                          '—'
                        ) : (
                          <input
                            value={row.category}
                            placeholder="入力支援"
                            onChange={(e) => updateRow(row.key, { category: e.target.value })}
                          />
                        )}
                      </td>
                      <td>{row.error ? '—' : `v${row.version}`}</td>
                      <td>{formatBytes(row.file.size)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="admin__submit">
              <button
                type="button"
                className="button"
                onClick={handleImport}
                disabled={importing || targets.length === 0 || invalid.length > 0}
              >
                {importing ? '取り込み中…' : `${targets.length} 件を取り込む`}
              </button>
              {invalid.length > 0 && (
                <span className="admin__error">
                  slug が未入力・不正な行があります（日本語名のみのプラグインは手入力が必要です）
                </span>
              )}
            </div>
          </>
        )}

        {log.length > 0 && (
          <div>
            <h2 style={{ fontSize: '1rem' }}>結果</h2>
            <ul>
              {log.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            {!importing && (
              <button type="button" className="button" onClick={() => navigate('/admin')}>
                一覧へ戻って公開設定する
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}

function sanitize(filename) {
  return filename.replace(/[^\w.\-]/g, '_')
}
