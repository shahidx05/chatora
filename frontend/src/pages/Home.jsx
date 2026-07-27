import Sidebar from '../components/sidebar/Sidebar'
import ChatWindow from '../components/chat/ChatWindow'

const Home = () => {
  return (
    <div className="h-screen flex bg-gray-100">
      <Sidebar />
      <ChatWindow />
    </div>
  )
}

export default Home