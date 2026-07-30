import { useNavigate } from 'react-router-dom'
import { useChat } from '../../context/ChatContext'
import ConversationList from './ConversationList'

const Sidebar = () => {
    const { conversations } = useChat()
    const navigate = useNavigate()

    return (
        <aside className="w-80 bg-white border-r flex flex-col">
            <div className="p-5 border-b" onClick={() => navigate('/')}>
                <h1 className="text-2xl font-bold">Chat App</h1>
                <input
                    type="text"
                    placeholder="Search users..."
                    className="mt-4 w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            <ConversationList
                conversations={conversations}
                onSelectConversation={(conv) => navigate(`/chat/${conv.conversationId}`)}
            />
        </aside>
    )
}

export default Sidebar