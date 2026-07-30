import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from './routes/ProtectedRoute'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import EmptyState from './components/common/EmptyState'
import ChatWindow from './components/chat/ChatWindow'


const App = () => {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Home />}>
            <Route index element={<EmptyState />} />
            <Route path="chat/:conversationId" element={<ChatWindow />} />
          </Route>
        </Route>
      </Routes>
    </>
  )
}

export default App