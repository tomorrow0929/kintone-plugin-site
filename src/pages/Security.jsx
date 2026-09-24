import { Link } from 'react-router-dom'
import { usePageMeta } from '../lib/meta.js'
import { links } from '../lib/site.js'
import { formatDate } from '../lib/format.js'
import {
  SECURITY_PATH,
  SECURITY_TITLE,
  SECURITY_DESCRIPTION,
  SECURITY_LEAD,
  SECURITY_POINTS,
  SECURITY_SECTIONS,
  SECURITY_UPDATED_AT,
  splitLinks,
} from '../lib/security.js'
import './Security.css'

/**
 * 「セキュリティについて」ページ。
 *
 * 文章はすべて src/lib/security.js にあります（静的HTMLと共用）。
 * このファイルは並べ方だけを決めています。
 */
export default function Security() {
  usePageMeta({
    title: SECURITY_TITLE,
    description: SECURITY_DESCRIPTION,
    path: SECURITY_PATH,
  })

  return (
    <article className="security">
      <nav className="security__back" aria-label="パンくず">
        <Link to="/">← kintone 無料プラグイン一覧</Link>
      </nav>

      <header className="security__header">
        <h1>セキュリティについて</h1>
        <p>{SECURITY_LEAD}</p>
      </header>

      <ul className="security__points">
        {SECURITY_POINTS.map((point) => (
          <li key={point.title}>
            <strong>{point.title}</strong>
            <span>{point.body}</span>
          </li>
        ))}
      </ul>

      <nav className="security__toc" aria-label="目次">
        <h2>目次</h2>
        <ol>
          {SECURITY_SECTIONS.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`}>{section.title}</a>
            </li>
          ))}
        </ol>
      </nav>

      {SECURITY_SECTIONS.map((section) => (
        <section key={section.id} id={section.id} className="security__section">
          <h2>{section.title}</h2>
          {section.blocks.map((block, i) => (
            <Block key={i} block={block} />
          ))}
        </section>
      ))}

      <p className="security__updated">最終更新日：{formatDate(SECURITY_UPDATED_AT)}</p>
    </article>
  )
}

function Block({ block }) {
  if (block.p) return <p>{renderText(block.p)}</p>

  const items = block.ul ?? block.ol
  const List = block.ol ? 'ol' : 'ul'
  return (
    <List>
      {items.map((item, i) => (
        <li key={i}>{renderText(item)}</li>
      ))}
    </List>
  )
}

/** [表示する文字](キー) をリンクにして返す */
function renderText(text) {
  return splitLinks(text, links).map((part, i) => {
    if (typeof part === 'string') return part
    if (!part.external) {
      return (
        <Link key={i} to={part.href}>
          {part.label}
        </Link>
      )
    }
    return (
      <a key={i} href={part.href} target="_blank" rel="noreferrer">
        {part.label}
      </a>
    )
  })
}
