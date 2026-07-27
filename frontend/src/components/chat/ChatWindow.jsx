import { useChat } from '../../context/ChatContext'
import ChatHeader from './ChatHeader'
import MessageList from './MessageList'
import TypingIndicator from './TypingIndicator'
import ChatInput from './ChatInput'
import EmptyState from '../common/EmptyState'

const ChatWindow = () => {
    const { selectedUser, messages, isTyping } = useChat()

    if (!selectedUser) {
        return <EmptyState />
    }

    return (
        <section className="flex-1 flex flex-col">
            <ChatHeader user={selectedUser} />
            <MessageList messages={messages} />
            <TypingIndicator isTyping={isTyping} />
            <ChatInput />
        </section>
    )
}

export default ChatWindow