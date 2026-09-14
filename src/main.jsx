import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './lib/amplify.js' // AWSへの接続設定（最初に読み込む）
import { initAnalytics } from './lib/analytics.js'
import App from './App.jsx'
import './styles/base.css'

// アクセス計測。環境変数 VITE_GA_ID が未設定のときは何もしません。
initAnalytics()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
