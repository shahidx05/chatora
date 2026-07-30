import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useChat } from '../../context/ChatContext'
import ChatHeader from './ChatHeader'
import MessageList from './MessageList'
import TypingIndicator from './TypingIndicator'
import ChatInput from './ChatInput'

const ChatWindow = () => {
    const { conversationId } = useParams()
    const { conversations, openConversation, closeConversation, messages, isTyping } = useChat()

    const selectedConversation = conversations.find(c => c.conversationId === conversationId)

    useEffect(() => {
        if (!conversationId) return
        openConversation(conversationId)
        return () => closeConversation()
    }, [conversationId])

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