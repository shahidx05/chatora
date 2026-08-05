import { useEffect } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { useChat } from '../../context/ChatContext'
import ChatHeader from './ChatHeader'
import MessageList from './MessageList'
import TypingIndicator from './TypingIndicator'
import ChatInput from './ChatInput'

const ChatWindow = () => {
    const { conversationId, userId } = useParams()
    const location = useLocation()
    const { conversations, openConversation, closeConversation, messages, isTyping } = useChat()

    // const selectedConversation = conversations.find(c => c.conversationId === conversationId)

    let selectedConversation = null;

    if (conversationId) {
        selectedConversation = conversations.find(c => c.conversationId === conversationId)
    } else if (userId) {
        selectedConversation = location.state?.participant;
    }

    useEffect(() => {
        if (conversationId) {
            openConversation(conversationId)
        } else {
            closeConversation()
        }
        return () => closeConversation()
    }, [conversationId, userId])

    if (!selectedConversation) return null

    if (!selectedConversation) return null

    return (
        <section className="flex-1 flex flex-col">
            <ChatHeader conversation={selectedConversation} />
            <MessageList messages={messages} />
            <TypingIndicator isTyping={isTyping} />
            <ChatInput conversationId={conversationId} receiverId={selectedConversation._id} />
        </section>
    )
}

export default ChatWindow