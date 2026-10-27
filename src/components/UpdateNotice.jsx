import { Link } from 'react-router-dom'
import { NOTICES } from '../lib/notices.js'
import './UpdateNotice.css'

/**
 * 不具合のお詫び・更新情報のお知らせ。
 * 一覧ページの、代行サービスの帯の上に置きます。
 * 文言は src/lib/notices.js にあります。
 */
export default function UpdateNotice() {
  if (NOTICES.length === 0) return null

  return (
    <>
      {NOTICES.map((notice) => (
        <aside className="update-notice" key={notice.title}>
          <p className="update-notice__date">{notice.date}</p>
          <h2 className="update-notice__title">{notice.title}</h2>
          {notice.body.map((text) => (
            <p key={text}>{text}</p>
          ))}
          {notice.link && (
            <Link className="update-notice__link" to={notice.link.href}>
              {notice.link.label} →
            </Link>
          )}
        </aside>
      ))}
    </>
  )
}
