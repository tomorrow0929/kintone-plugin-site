import { PLUGIN_FAQ } from '../lib/faq.js'
import { links } from '../lib/site.js'
import './FaqSection.css'

/**
 * プラグイン詳細ページの「よくあるご質問」。
 *
 * 中身は src/lib/faq.js にあり、36本すべて共通。
 * ビルド時の静的HTML（scripts/lib/render-page.mjs）も同じデータを読むので、
 * 文言を変えるときは faq.js だけを直せばよい。
 *
 * 折りたたみ（details）にはしていない。5問しかないうえ、
 * 「開かないと読めない」と結局読まれず、同じ質問が問い合わせで来るため。
 */
export default function FaqSection() {
  return (
    <section className="faq">
      <h2>よくあるご質問</h2>
      <dl className="faq__list">
        {PLUGIN_FAQ.map((item) => (
          <div className="faq__item" key={item.q}>
            <dt>{item.q}</dt>
            <dd>{item.a}</dd>
          </div>
        ))}
      </dl>
      <p className="faq__more">
        ここに無い場合は{' '}
        <a href={links.support} target="_blank" rel="noreferrer">
          サポート範囲
        </a>
        {' ・ '}
        <a href={links.terms} target="_blank" rel="noreferrer">
          利用規約
        </a>
        {' をご確認のうえ、'}
        <a href={links.contact} target="_blank" rel="noreferrer">
          お問い合わせ
        </a>
        {' からお寄せください。'}
      </p>
    </section>
  )
}
