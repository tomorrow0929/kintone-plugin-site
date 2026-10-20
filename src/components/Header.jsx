import { Link, NavLink } from 'react-router-dom'
import { links } from '../lib/site.js'
import './Header.css'

export default function Header() {
  return (
    <header className="site-header">
      <div className="site-header__brand">
        {/* ロゴは事業サイト（to-morrow.net）のトップへ。横の「kintone プラグイン」はこのサイトの一覧へ */}
        <a href={links.about} className="site-header__home" aria-label="to.Morrow ホームページのトップへ">
          <img src="/logo.svg" alt="to.Morrow" className="site-header__logo" />
        </a>
        <Link to="/" className="site-header__label">
          kintone プラグイン
        </Link>
      </div>
      <nav className="site-header__nav">
        <NavLink to="/" end>
          プラグイン一覧
        </NavLink>
        {/* URLは src/lib/site.js にまとめています（ここに直接書かない） */}
        <a href={links.services} target="_blank" rel="noreferrer">
          料金・代行
        </a>
        <a href={links.about} target="_blank" rel="noreferrer">
          to.Morrow について
        </a>
      </nav>
    </header>
  )
}
