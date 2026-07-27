import { useChat } from '../../context/ChatContext'
import UserList from './UserList'

const Sidebar = () => {
    const { users, selectedUser, selectUser } = useChat()

    return (
        <aside className="w-80 bg-white border-r flex flex-col">
            <div className="p-5 border-b">
                <h1 className="text-2xl font-bold">Chat App</h1>
                <input
                    type="text"
                    placeholder="Search users..."
                    className="mt-4 w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            <UserList
                users={users}
                selectedUser={selectedUser}
                onSelectUser={selectUser}
            />
        </aside>
    )
}

export default Sidebar