import { useState, useEffect } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { useChat } from '../../context/ChatContext'
import ChatHeader from './ChatHeader'
import MessageList from './MessageList'
import TypingIndicator from './TypingIndicator'
import ChatInput from './ChatInput'
import GroupInfo from './GroupInfo'

const ChatWindow = () => {
    const { conversationId, userId } = useParams()
    const location = useLocation()
    const navigate = useNavigate()
    const { conversations, openConversation, closeConversation, messages, isTyping } = useChat()

    const [showGroupInfo, setShowGroupInfo] = useState(false);

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

        setShowGroupInfo(false);
        return () => closeConversation()
    }, [conversationId, userId, location.state, navigate])

    if (!selectedConversation) return null
    const isGroupChat = selectedConversation.isGroupChat;

    return (
        <div className="flex-1 flex overflow-hidden">
            <section className="flex-1 flex flex-col h-full">
                <ChatHeader
                    conversation={selectedConversation}
                    onInfoClick={() => setShowGroupInfo(!showGroupInfo)}
                />
                <MessageList messages={messages} isGroupChat={isGroupChat} />
                <TypingIndicator typingData={isTyping} />
                <ChatInput conversationId={conversationId} receiverId={selectedConversation._id} />
            </section>

            {/* Right Sidebar (Drawer) */}
            {isGroupChat && showGroupInfo && (
                <GroupInfo
                    conversation={selectedConversation}
                    onClose={() => setShowGroupInfo(false)}
                />
            )}
        </div>
    )
}

export default ChatWindow