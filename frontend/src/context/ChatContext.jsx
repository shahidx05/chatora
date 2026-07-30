import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'
import { getConversations } from '../services/conversation.service'
import { getMessages } from '../services/message.service'

const ChatContext = createContext({})

export const useChat = () => {
    return useContext(ChatContext);
};

export const ChatProvider = ({ children }) => {
    const { token, user: currentUser } = useAuth()

    const [conversations, setConversations] = useState([])
    const [activeConversationId, setActiveConversationId] = useState(null)
    const [messages, setMessages] = useState([])
    const [isTyping, setIsTyping] = useState(false)

    const socket = useRef(null)
    const typingTimeout = useRef(null)

    // --- connection setup ---
    useEffect(() => {
        if (!token) return

        socket.current = io(import.meta.env.VITE_SOCKET_URL, { auth: { token } })

        socket.current.on('connect', () => console.log('connected', socket.current.id))
        socket.current.on('connect_error', (err) => console.log('Connection failed:', err.message))

        socket.current.on("online_users", (onlineIds) => {
            setConversations(prev =>
                prev.map(conv => ({ ...conv, online: onlineIds.includes(conv._id) }))
            )
        })

        return () => {
            socket.current?.disconnect()
        }
    }, [token])

    // --- event listeners: filtered by activeConversationId ---
    useEffect(() => {
        if (!socket.current) return

        // find the participant id for the currently open conversation (for typing match)
        const activeParticipantId = conversations.find(
            c => c.conversationId === activeConversationId
        )?._id

        const receiveHandler = (data) => {
            const isActive = String(data.conversation) === String(activeConversationId)

            if (isActive) {
                setMessages(prev => [...prev, data])
                if (String(data.sender) !== String(currentUser?.id || currentUser?._id)) {
                    socket.current.emit('mark_seen', { conversationId: activeConversationId })
                }
            }
        }

        const typingHandler = (data) => {
            if (activeParticipantId && String(data.sender) === String(activeParticipantId)) {
                setIsTyping(data.typing)
            }
        }

        const onlineHandler = (data) => {
            setConversations(prev =>
                prev.map(conv =>
                    conv._id === data.userId ? { ...conv, online: true, lastSeen: null } : conv
                )
            )
        }

        const offlineHandler = (data) => {
            setConversations(prev =>
                prev.map(conv =>
                    conv._id === data.userId ? { ...conv, online: false, lastSeen: data.lastSeen } : conv
                )
            )
        }

        const statusHandler = (data) => {
            setMessages(prev =>
                prev.map(msg =>
                    String(msg._id) === String(data.messageId) ? { ...msg, status: data.status } : msg
                )
            )
        }

        socket.current.on("receive_message", receiveHandler)
        socket.current.on("typing", typingHandler)
        socket.current.on("user_online", onlineHandler)
        socket.current.on("user_offline", offlineHandler)
        socket.current.on("message_status_updated", statusHandler)

        return () => {
            socket.current.off("receive_message", receiveHandler)
            socket.current.off("typing", typingHandler)
            socket.current.off("user_online", onlineHandler)
            socket.current.off("user_offline", offlineHandler)
            socket.current.off("message_status_updated", statusHandler)
        }
    }, [activeConversationId, conversations, currentUser])

    // --- fetch conversations ---
    useEffect(() => {
        if (!token) return

        const fetchConversations = async () => {
            try {
                const data = await getConversations()
                const result = data.conversations.map((conv) => ({
                    ...conv.participant,
                    conversationId: conv._id,
                    lastMessage: conv.lastMessage?.content || null,
                    lastMessageTime: conv.lastMessage?.createdAt
                        ? new Date(conv.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : null,
                    unreadCount: conv.unreadCount,
                }))
                setConversations(result)
            } catch (error) {
                console.error("Error fetching conversations:", error)
            }
        }

        fetchConversations()
    }, [token])

    // --- open / close a conversation (called by ChatWindow based on URL) ---
    const openConversation = async (conversationId) => {
        setActiveConversationId(conversationId)
        setIsTyping(false)

        try {
            const data = await getMessages(conversationId)
            setMessages(data.messages)
        } catch (error) {
            console.error('Error fetching messages:', error)
        }

        socket.current?.emit('mark_seen', { conversationId })
    }

    const closeConversation = () => {
        setActiveConversationId(null)
        setMessages([])
        setIsTyping(false)
    }

    // --- send a message ---
    const sendMessage = (text, conversationId, receiverId) => {
        if (!text.trim() || !socket.current) return

        socket.current.emit('send_message', {
            receiver: receiverId,
            conversationId,
            message: text
        })

        socket.current.emit('typing', { receiver: receiverId, typing: false })
    }

    // --- typing debounce ---
    const handleTyping = (receiverId) => {
        if (!socket.current || !receiverId) return

        socket.current.emit("typing", { receiver: receiverId, typing: true })

        clearTimeout(typingTimeout.current)

        typingTimeout.current = setTimeout(() => {
            socket.current.emit("typing", { receiver: receiverId, typing: false })
        }, 1000)
    }

    const value = {
        conversations,
        activeConversationId,
        messages,
        isTyping,
        currentUser,
        openConversation,
        closeConversation,
        sendMessage,
        handleTyping
    }

    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    )
}

export default ChatContext