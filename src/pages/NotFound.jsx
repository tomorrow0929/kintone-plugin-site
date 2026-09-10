import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="status">
      <h1>ページが見つかりません</h1>
      <p>
        <Link to="/">プラグイン一覧へ</Link>
      </p>
    </div>
  )
}
