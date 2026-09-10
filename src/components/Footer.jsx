import { Link } from 'react-router-dom'
import './Footer.css'

export default function Footer() {
  return (
    <footer className="site-footer">
      <p>&copy; {new Date().getFullYear()} to.Morrow</p>
      <p className="site-footer__note">
        kintone はサイボウズ株式会社の登録商標です。本サイトはサイボウズ株式会社とは関係のない、
        to.Morrow が独自に開発・提供するプラグインの配布ページです。
      </p>
      <p>
        <Link to="/admin">管理者ログイン</Link>
      </p>
    </footer>
  )
}
