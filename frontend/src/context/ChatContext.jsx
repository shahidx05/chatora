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
    const [onlineUserIds, setOnlineUserIds] = useState([])

    const socket = useRef(null)
    const typingTimeout = useRef(null)

    // --- connection setup ---
    useEffect(() => {
        if (!token) return

        socket.current = io(import.meta.env.VITE_SOCKET_URL, { auth: { token } })

        socket.current.on('connect', () => console.log('connected', socket.current.id))
        socket.current.on('connect_error', (err) => console.log('Connection failed:', err.message))

        socket.current.on("online_users", (onlineIds) => {
            setOnlineUserIds(onlineIds)
        })

        return () => {
            socket.current?.disconnect()
        }
    }, [token])

    useEffect(() => {
        if (conversations.length === 0 || onlineUserIds.length === 0) return
        setConversations(prev =>
            prev.map(conv => ({ ...conv, online: onlineUserIds.includes(conv._id) }))
        )
    }, [conversations.length, onlineUserIds])

    // --- event listeners: filtered by activeConversationId ---
    useEffect(() => {
        if (!socket.current) return

        // find the participant id for the currently open conversation (for typing match)
        const activeParticipantId = conversations.find(
            c => c.conversationId === activeConversationId
        )?._id

        const receiveHandler = (data) => {
            const isActive = String(data.conversation) === String(activeConversationId)
            const isIncoming = String(data.sender) !== String(currentUser.id);

            updateConversation(data, isIncoming && !isActive);

            if (isActive) {
                setMessages(prev => [...prev, data])
                if (isIncoming) {
                    socket.current.emit('mark_seen', { conversationId: activeConversationId })
                }
            }
        }

        const typingHandler = (data) => {
            setConversations(prev =>
                prev.map(conv =>
                    String(conv._id) === String(data.sender)
                        ? { ...conv, typing: data.typing }
                        : conv
                )
            );
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
            setConversations(prev =>
                prev.map(conv =>
                    conv.lastMessageId === data.messageId
                        ? {
                            ...conv,
                            lastMessageStatus: data.status,
                        }
                        : conv
                )
            );
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
                    lastMessageId: conv.lastMessage?._id || null,
                    lastMessageSender: conv.lastMessage?.sender || null,
                    lastMessageStatus: conv.lastMessage?.status || null,
                    lastMessageTime: conv.lastMessage?.createdAt
                        ? new Date(conv.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : null,
                    unreadCount: conv.unreadCount,
                    typing: false,
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

        setConversations(prev =>
            prev.map(conv =>
                conv.conversationId === conversationId
                    ? { ...conv, unreadCount: 0 }
                    : conv
            )
        );

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

    // --- update conversations ---
    const updateConversation = (message, incrementUnread = false) => {
        setConversations(prev => {
            const index = prev.findIndex(
                c => c.conversationId === message.conversation
            );

            if (index === -1) return prev;

            const updated = [...prev];

            const conversation = {
                ...updated[index],
                lastMessage: message.content,
                lastMessageId: message._id,
                lastMessageSender: message.sender,
                lastMessageStatus: message.status,
                lastMessageTime: new Date(message.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                }),
                typing: false,
            };

            if (incrementUnread) conversation.unreadCount++;

            updated.splice(index, 1);
            updated.unshift(conversation);

            return updated;
        });
    };
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