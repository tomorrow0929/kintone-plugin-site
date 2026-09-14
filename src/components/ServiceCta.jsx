import { links, prices } from '../lib/site.js'
import { trackCtaClick } from '../lib/analytics.js'
import './ServiceCta.css'

/**
 * 有料サービスへの導線。
 *
 * 【考え方】
 * プラグインは無料のままにして、「設定する手間」だけを有料で引き受けます。
 * 台紙PDFの用意や項目の配置は、機能があっても利用者には面倒な作業で、
 * ここが最後まで残る困りごとになります。
 *
 * variant:
 *   'detail' … プラグイン詳細ページの下部に置く大きめのブロック
 *   'banner' … 一覧ページの上部に置く1行の帯
 */
export default function ServiceCta({ variant = 'detail', reports = false, pluginName = '' }) {
  const primaryHref = reports ? links.reports : links.services
  const primaryLabel = reports ? '帳票作成代行について見る' : '料金と依頼の流れを見る'

  const handleClick = (target) => () => trackCtaClick({ location: variant, target })

  if (variant === 'banner') {
    return (
      <aside className="service-banner">
        <p className="service-banner__text">
          <strong>設定や帳票づくりでお困りですか？</strong>
          <span>
            台紙の作成から項目の配置、動作確認までを代行しています（帳票作成代行 {prices.report}〜／
            初期設定代行 {prices.setup}〜）。
          </span>
        </p>
        <a
          className="button button--compact"
          href={links.services}
          target="_blank"
          rel="noreferrer"
          onClick={handleClick('services')}
        >
          料金を見る
        </a>
      </aside>
    )
  }

  return (
    <section className="service-cta">
      <h2>設定でつまずいたら、代行できます</h2>
      <p className="service-cta__lead">
        {pluginName ? `${pluginName}を含め、` : ''}
        プラグイン本体は無料のままご利用いただけます。
        ご自身で設定する時間が取れないときだけ、作業をお引き受けします。
      </p>

      <ul className="service-cta__menu">
        <li>
          <span className="service-cta__name">帳票テンプレート作成代行</span>
          <span className="service-cta__price">{prices.report}〜</span>
          <span className="service-cta__note">
            台紙PDFの作成、項目の配置、テンプレート登録、実データでの出力確認まで
          </span>
        </li>
        <li>
          <span className="service-cta__name">プラグイン初期設定代行</span>
          <span className="service-cta__price">{prices.setup}〜</span>
          <span className="service-cta__note">1アプリ・プラグイン3本までの設定と動作確認</span>
        </li>
        <li>
          <span className="service-cta__name">kintoneアプリ作成・カスタマイズ</span>
          <span className="service-cta__price">{prices.app}〜</span>
          <span className="service-cta__note">
            アプリの設計・構築、JavaScript カスタマイズ、プラグインの個別改修
          </span>
        </li>
      </ul>

      <div className="service-cta__actions">
        <a
          className="button"
          href={primaryHref}
          target="_blank"
          rel="noreferrer"
          onClick={handleClick(reports ? 'reports' : 'services')}
        >
          {primaryLabel}
        </a>
        <a
          className="button button--ghost"
          href={links.contact}
          target="_blank"
          rel="noreferrer"
          onClick={handleClick('contact')}
        >
          無料で相談する
        </a>
      </div>

      <p className="service-cta__fineprint">
        お見積りまで費用はかかりません。ご相談内容によっては、
        設定を変えるだけで解決できる場合もあります。その場合はそのようにお伝えします。
      </p>
    </section>
  )
}
