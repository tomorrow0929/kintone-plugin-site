import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import SetupNotice from './components/SetupNotice.jsx'
import PluginList from './pages/PluginList.jsx'
import PluginDetail from './pages/PluginDetail.jsx'
import NotFound from './pages/NotFound.jsx'
import { isConfigured } from './lib/amplify.js'

// 管理画面はログイン用の部品が重いので、開いたときだけ読み込みます。
// これで一般の訪問者が見るページが軽くなります。
const Admin = lazy(() => import('./pages/admin/Admin.jsx'))

export default function App() {
  return (
    <>
      <Header />
      <main className="page">
        {!isConfigured && <SetupNotice />}
        <Routes>
          <Route path="/" element={<PluginList />} />
          <Route path="/plugins/:slug" element={<PluginDetail />} />
          <Route
            path="/admin/*"
            element={
              <Suspense fallback={<p className="status">読み込み中…</p>}>
                <Admin />
              </Suspense>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}
