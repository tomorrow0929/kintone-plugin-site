import { lazy, Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import SetupNotice from './components/SetupNotice.jsx'
import NoIndexRoute from './components/NoIndexRoute.jsx'
import PluginList from './pages/PluginList.jsx'
import PluginDetail from './pages/PluginDetail.jsx'
import NotFound from './pages/NotFound.jsx'
import { isConfigured } from './lib/amplify.js'

// 管理画面はログイン用の部品が重いので、開いたときだけ読み込みます。
// これで一般の訪問者が見るページが軽くなります。
const Admin = lazy(() => import('./pages/admin/Admin.jsx'))

export default function App() {
  // 管理画面は表の列が多いので、本文の幅より広く使う
  const isAdmin = useLocation().pathname.startsWith('/admin')

  return (
    <>
      <Header />
      <main className={isAdmin ? 'page page--wide' : 'page'}>
        {!isConfigured && <SetupNotice />}
        <Routes>
          <Route path="/" element={<PluginList />} />
          <Route path="/plugins/:slug" element={<PluginDetail />} />
          <Route
            path="/admin/*"
            element={
              // 管理画面は検索結果に出さない（NoIndexRoute が noindex を出します）
              <NoIndexRoute title="管理画面 | to.Morrow">
                <Suspense fallback={<p className="status">読み込み中…</p>}>
                  <Admin />
                </Suspense>
              </NoIndexRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}
