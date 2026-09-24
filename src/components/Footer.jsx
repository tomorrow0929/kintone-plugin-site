import { Link } from 'react-router-dom'
import { links } from '../lib/site.js'
import './Footer.css'

export default function Footer() {
  return (
    <footer className="site-footer">
      <p className="site-footer__links">
        <a href={links.services} target="_blank" rel="noreferrer">
          有料メニュー・料金
        </a>
        {' ｜ '}
        <a href={links.support} target="_blank" rel="noreferrer">
          サポート範囲
        </a>
        {' ｜ '}
        <a href={links.terms} target="_blank" rel="noreferrer">
          利用規約
        </a>
        {' ｜ '}
        <a href={links.privacy} target="_blank" rel="noreferrer">
          プライバシーポリシー
        </a>
        {' ｜ '}
        <Link to="/security">セキュリティについて</Link>
        {' ｜ '}
        <a href={links.contact} target="_blank" rel="noreferrer">
          お問い合わせ
        </a>
      </p>
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
