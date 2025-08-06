import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { NotificationProvider } from './components/notification/notification';

// 页面导入
import WelcomePage from './pages/WelcomePage'
import RenderPage from './pages/RenderPage'
import Login from './pages/admin/Login'
import Dashboard from './pages/admin/Dashboard'

function App() {
  const [theme] = useState<'light' | 'dark'>('dark')

  // 检查用户是否已登录（用于后台管理系统）
  const isLoggedIn = () => localStorage.getItem('isLoggedIn') === 'true'

  // 受保护的路由 - 只有登录后才能访问
  const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
    return isLoggedIn() ? children : <Navigate to="/admin" />
  }

  return (
    <NotificationProvider>
      <Router>
        <div className={`app-container theme-${theme}`}>
          <Routes>
            <Route path="/" element={<WelcomePage theme={theme} />} />
            <Route path="/render" element={<RenderPage theme={theme} />} />
            <Route path="/render/:modelId" element={<RenderPage theme={theme} />} />
            <Route path="/admin" element={<Login />} />
            <Route path="/admin/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
          </Routes>
        </div>
      </Router>
    </NotificationProvider>
  );
}

export default App