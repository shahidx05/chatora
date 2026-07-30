import { Outlet } from 'react-router-dom'
import Sidebar from '../components/sidebar/Sidebar'

const Home = () => {
  return (
    <div className="h-screen flex bg-gray-100">
      <Sidebar />
      <Outlet />
    </div>
  )
}

export default Home