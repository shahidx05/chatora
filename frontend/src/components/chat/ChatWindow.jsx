import { useEffect } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useChat } from '../../context/ChatContext'
import ChatHeader from './ChatHeader'
import MessageList from './MessageList'
import TypingIndicator from './TypingIndicator'
import ChatInput from './ChatInput'

const ChatWindow = () => {
    const { conversationId, userId } = useParams()
    const location = useLocation()
    const navigate = useNavigate()
    const { conversations, openConversation, closeConversation, messages, isTyping } = useChat()

    let selectedConversation = null;

    if (conversationId) {
        selectedConversation = conversations.find(c => c.conversationId === conversationId)
    } else if (userId) {
        selectedConversation = location.state?.participant;
    }

    useEffect(() => {
        if (userId && !location.state?.participant) {
            navigate('/', { replace: true });
            return;
        }

        if (conversationId) {
            openConversation(conversationId)
        } else {
            closeConversation()
        }
        return () => closeConversation()
    }, [conversationId, userId, location.state, navigate])

    if (!selectedConversation) return null

    const isGroupChat = selectedConversation.isGroupChat;

    return (
        <section className="flex-1 flex flex-col">
            <ChatHeader conversation={selectedConversation} />
            <MessageList messages={messages} isGroupChat={isGroupChat} />
            <TypingIndicator typingData={isTyping} />
            <ChatInput conversationId={conversationId} receiverId={selectedConversation._id} />
        </section>
    )
}

export default ChatWindow