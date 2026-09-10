import { Link, NavLink } from 'react-router-dom'
import './Header.css'

export default function Header() {
  return (
    <header className="site-header">
      <Link to="/" className="site-header__brand">
        <img src="/logo.svg" alt="to.Morrow" className="site-header__logo" />
        <span className="site-header__label">kintone プラグイン</span>
      </Link>
      <nav className="site-header__nav">
        <NavLink to="/" end>
          プラグイン一覧
        </NavLink>
        <a href="https://main.d3k8o4bbbbo4ke.amplifyapp.com/" target="_blank" rel="noreferrer">
          to.Morrow について
        </a>
      </nav>
    </header>
  )
}
