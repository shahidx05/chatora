import { useRef, useEffect } from 'react'
import { useChat } from '../../context/ChatContext'
import MessageBubble from './MessageBubble'

const MessageList = ({ messages, isGroupChat }) => {
    const { currentUser } = useChat()
    const messagesEndRef = useRef(null)

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    return (
        <div className="flex-1 overflow-y-auto bg-gray-50 px-6 py-5 space-y-4">
            {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400">
                    No messages yet.
                </div>
            ) : (
                messages.map((message) => {
                    // Extract ID safely (whether populated object or string ID)
                    const senderId = message.sender?._id || message.sender;
                    const isMine = String(senderId) === String(currentUser?.id || currentUser?._id);

                    return (
                        <MessageBubble
                            key={message._id}
                            message={message}
                            isMine={isMine}
                            isGroupChat={isGroupChat}
                        />
                    )
                })
            )}
            <div ref={messagesEndRef}></div>
        </div>
    )
}

export default MessageList