import './SetupNotice.css'

/**
 * amplify_outputs.json がまだ無いとき（＝AWSに未接続のとき）に出る案内。
 * 本番では表示されません。
 */
export default function SetupNotice() {
  return (
    <div className="setup-notice">
      <h2>AWS にまだ接続されていません</h2>
      <p>
        データベースとファイル置き場（AWS）の設定が済んでいないため、プラグインを読み込めません。
        画面のデザイン確認はこのまま行えます。
      </p>
      <p>
        接続するには、AWS の認証情報を設定したうえで次を実行してください。詳しい手順は
        <code>README.md</code> の「AWS のセットアップ」を参照してください。
      </p>
      <pre>npm run sandbox</pre>
    </div>
  )
}
