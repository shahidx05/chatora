import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
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
    const navigate = useNavigate()
    const location = useLocation()

    const [conversations, setConversations] = useState([])
    const [activeConversationId, setActiveConversationId] = useState(null)
    const [messages, setMessages] = useState([])
    const [isTyping, setIsTyping] = useState(false)
    const [onlineUserIds, setOnlineUserIds] = useState([])
    const [hasMore, setHasMore] = useState(false)
    const [loadingOlder, setLoadingOlder] = useState(false)
    const activeIdRef = useRef(null)        
    const loadingOlderRef = useRef(false)  

    const socket = useRef(null)
    const typingTimeout = useRef(null)
    const conversationsRef = useRef(conversations)

    useEffect(() => {
        conversationsRef.current = conversations
    }, [conversations])

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
            console.log("Received message:", data);
            const existingConv = conversationsRef.current.find(c => String(c.conversationId) === String(data.conversation));

            const senderId = data.sender?._id || data.sender;
            const myId = currentUser?.id || currentUser?._id;
 
            const isIncoming = String(senderId) !== String(myId);
            const isPendingChat = location.pathname.includes('/chat/new/');;

            let isActive = String(data.conversation) === String(activeConversationId);

            if (isIncoming && !existingConv && !data.isSystemMessage) {
                navigate(`/chat/${data.conversation}`, { replace: true });
                setActiveConversationId(data.conversation);
                isActive = true;
            }

            if (!existingConv || data.isSystemMessage) {
                fetchConversations();
            } else {
                updateConversation(data, isIncoming && !isActive);
            }


            if (isActive || isPendingChat) {
                setMessages(prev => [...prev, data])
                if (isIncoming && !data.isSystemMessage) {
                    socket.current.emit('mark_seen', { conversationId: activeConversationId });
                }
            }

            if (data.isSystemMessage) {
                fetchConversations();
            }
        }

        const typingHandler = (data) => {
            setConversations(prev =>
                prev.map(conv => {
                    const isMatch = data.conversationId
                        ? String(conv.conversationId) === String(data.conversationId)
                        : String(conv._id) === String(data.sender);

                    return isMatch ? { ...conv, typing: data.typing } : conv;
                })
            );

            const isCurrentChat = data.conversationId
                ? String(data.conversationId) === String(activeConversationId)
                : (activeParticipantId && String(data.sender) === String(activeParticipantId));

            if (isCurrentChat) {
                if (data.typing) {
                    setIsTyping(data.senderName ? `${data.senderName} is typing...` : true)
                } else {
                    setIsTyping(false)
                }
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

        // const statusHandler = (data) => {
        //     setMessages(prev =>
        //         prev.map(msg =>
        //             String(msg._id) === String(data.messageId) ? { ...msg, status: data.status } : msg
        //         )
        //     )
        //     setConversations(prev =>
        //         prev.map(conv =>
        //             conv.lastMessageId === data.messageId
        //                 ? {
        //                     ...conv,
        //                     lastMessageStatus: data.status,
        //                 }
        //                 : conv
        //         )
        //     );
        // }
        // handles single-message "delivered" updates (1-1 chats only)
        const deliveredHandler = (data) => {
            setMessages(prev =>
                prev.map(msg =>
                    String(msg._id) === String(data.messageId) ? { ...msg, status: data.status } : msg
                )
            )
            setConversations(prev =>
                prev.map(conv =>
                    conv.lastMessageId === data.messageId
                        ? { ...conv, lastMessageStatus: data.status }
                        : conv
                )
            )
        }

        // handles batch "seen" updates (fires when someone opens the conversation)
        const seenHandler = (data) => {
            setMessages(prev =>
                prev.map(msg =>
                    String(msg.conversation) === String(data.conversationId)
                        ? { ...msg, status: 'seen' }
                        : msg
                )
            )
            setConversations(prev =>
                prev.map(conv =>
                    conv.conversationId === data.conversationId
                        ? { ...conv, lastMessageStatus: 'seen' }
                        : conv
                )
            )
        }

        socket.current.on("receive_message", receiveHandler)
        socket.current.on("typing", typingHandler)
        socket.current.on("user_online", onlineHandler)
        socket.current.on("user_offline", offlineHandler)
        // socket.current.on("message_status_updated", statusHandler)
        socket.current.on("message_status_updated", deliveredHandler)
        socket.current.on("messages_seen", seenHandler)

        return () => {
            socket.current.off("receive_message", receiveHandler)
            socket.current.off("typing", typingHandler)
            socket.current.off("user_online", onlineHandler)
            socket.current.off("user_offline", offlineHandler)
            // socket.current.off("message_status_updated", statusHandler)
            socket.current.off("message_status_updated", deliveredHandler)
            socket.current.off("messages_seen", seenHandler)
        }
    }, [activeConversationId, currentUser])

    // --- fetch conversations ---
    const fetchConversations = useCallback(async () => {
        if (!token) return

        try {
            const data = await getConversations()
            const result = data.conversations.map((conv) => {
                const chatName = conv.isGroupChat ? conv.groupName : conv.participant?.name;
                const participantId = conv.isGroupChat ? null : conv.participant?._id;

                return {
                    ...conv.participant,
                    _id: participantId,
                    name: chatName,
                    isGroupChat: conv.isGroupChat,
                    conversationId: conv._id,
                    description: conv.groupDescription || "",
                    participants: conv.participants || [],
                    groupAdmins: conv.groupAdmins || [],
                    lastMessage: conv.lastMessage?.content || null,
                    lastMessageId: conv.lastMessage?._id || null,
                    lastMessageSender: conv.lastMessage?.sender || null,
                    lastMessageStatus: conv.lastMessage?.status || null,
                    lastMessageTime: conv.lastMessage?.createdAt
                        ? new Date(conv.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : null,
                    unreadCount: conv.unreadCount,
                    typing: false,
                }
            })
            setConversations(result)
        } catch (error) {
            console.error("Error fetching conversations:", error)
        }
    }, [token])

    useEffect(() => {
        fetchConversations()
    }, [fetchConversations])

    // --- open / close a conversation (called by ChatWindow based on URL) ---
    const openConversation = async (conversationId) => {
        // If it's a pending chat (no ID yet), just setup empty state and exit
        if (!conversationId) {
            activeIdRef.current = null
            setActiveConversationId(null)
            setMessages([])
            setHasMore(false)
            setIsTyping(false)
            return;
        }

        activeIdRef.current = conversationId
        setActiveConversationId(conversationId)
        setHasMore(false)
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
            if (activeIdRef.current !== conversationId) return // user switched chats meanwhile
            setMessages(data.messages)
            setHasMore(Boolean(data.hasMore))
        } catch (error) {
            console.error('Error fetching messages:', error)
        }

        socket.current?.emit('mark_seen', { conversationId })
    }

    const closeConversation = () => {
        activeIdRef.current = null
        setActiveConversationId(null)
        setMessages([])
        setHasMore(false)
        setIsTyping(false)
    }

    // --- infinite scroll: load the page of messages older than `beforeId` ---
    const loadOlderMessages = async (beforeId) => {
        const conversationId = activeIdRef.current
        if (!conversationId || !beforeId || loadingOlderRef.current) return

        loadingOlderRef.current = true
        setLoadingOlder(true)
        try {
            const data = await getMessages(conversationId, { before: beforeId })
            if (activeIdRef.current !== conversationId) return // switched chats while loading

            setMessages(prev => {
                // skip anything already in the list (e.g. a live message that raced the fetch)
                const existing = new Set(prev.map(m => String(m._id)))
                return [...data.messages.filter(m => !existing.has(String(m._id))), ...prev]
            })
            setHasMore(Boolean(data.hasMore))
        } catch (error) {
            console.error('Error loading older messages:', error)
        } finally {
            loadingOlderRef.current = false
            setLoadingOlder(false)
        }
    }

    // --- update conversations ---
    const updateConversation = useCallback((message, incrementUnread = false) => {
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
    }, []);
    // --- send a message ---
    // returns a Promise<{ ok, message?, error? }> that resolves when the server acks
    const sendMessage = (text, conversationId, receiverId, attachment = null) => {
        if ((!text.trim() && !attachment) || !socket.current) {
            return Promise.resolve({ ok: false, error: 'Not connected' })
        }

        // same id on every retry -> server stores the message only once
        const clientMsgId = crypto.randomUUID()

        return new Promise((resolve) => {
            socket.current.timeout(15000).emit('send_message', {
                receiver: receiverId,
                conversationId,
                message: text,
                attachment,
                clientMsgId
            }, (err, res) => {
                if (err) return resolve({ ok: false, error: 'Server did not respond, try again' })
                resolve(res)
            })

            socket.current.emit('typing', { receiver: receiverId, typing: false })
        })
    }

    // --- typing debounce ---
    const handleTyping = (receiverId, conversationId) => {
        if (!socket.current) return

        if (!receiverId && !conversationId) return;

        socket.current.emit("typing", { receiver: receiverId, conversationId, typing: true })

        clearTimeout(typingTimeout.current)

        typingTimeout.current = setTimeout(() => {
            socket.current.emit("typing", { receiver: receiverId, conversationId, typing: false })
        }, 1000)
    }

    // --- update specific conversation metadata instantly ---
    const updateSpecificConversation = useCallback((conversationId, updatedData) => {
        setConversations(prev =>
            prev.map(conv =>
                conv.conversationId === conversationId
                    ? { ...conv, ...updatedData }
                    : conv
            )
        );
    }, []);

    const value = {
        conversations,
        activeConversationId,
        messages,
        hasMore,
        loadingOlder,
        isTyping,
        currentUser,
        openConversation,
        closeConversation,
        loadOlderMessages,
        sendMessage,
        handleTyping,
        fetchConversations,
        updateSpecificConversation
    }

    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    )
}

export default ChatContext