import { Routes, Route, Link } from 'react-router-dom'
import { Authenticator } from '@aws-amplify/ui-react'
import '@aws-amplify/ui-react/styles.css'
import { isConfigured } from '../../lib/amplify.js'
import AdminPluginList from './AdminPluginList.jsx'
import AdminPluginForm from './AdminPluginForm.jsx'
import AdminBulkImport from './AdminBulkImport.jsx'
import './Admin.css'

export default function Admin() {
  if (!isConfigured) {
    return (
      <p className="status">
        AWS に接続していないため、管理画面は利用できません。<Link to="/">一覧へ戻る</Link>
      </p>
    )
  }

  return (
    // hideSignUp: 一般の人がアカウントを作れないようにする
    <Authenticator hideSignUp>
      {({ signOut, user }) => (
        <div className="admin">
          <div className="admin__bar">
            <div>
              <strong>管理画面</strong>
              <span className="admin__user">{user?.signInDetails?.loginId}</span>
            </div>
            <button type="button" className="button button--ghost" onClick={signOut}>
              ログアウト
            </button>
          </div>

          <Routes>
            <Route index element={<AdminPluginList />} />
            <Route path="new" element={<AdminPluginForm mode="create" />} />
            <Route path="edit/:id" element={<AdminPluginForm mode="edit" />} />
            <Route path="import" element={<AdminBulkImport />} />
          </Routes>
        </div>
      )}
    </Authenticator>
  )
}
