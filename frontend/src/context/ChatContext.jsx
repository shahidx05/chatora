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
    const [replyTo, setReplyTo] = useState(null) // { messageId, senderName, preview, type }
    const activeIdRef = useRef(null)        // which chat is open right now (for stale-response checks)
    const loadingOlderRef = useRef(false)   // blocks double fetches from rapid scroll events

    const socket = useRef(null)
    const typingTimeout = useRef(null)
    const conversationsRef = useRef(conversations)

    useEffect(() => {
        conversationsRef.current = conversations
    }, [conversations])

    // latest messages of the open chat, readable from socket callbacks without stale closures
    const messagesRef = useRef([])
    useEffect(() => {
        messagesRef.current = messages
    }, [messages])

    // --- connection setup ---
    useEffect(() => {
        if (!token) return

        socket.current = io(import.meta.env.VITE_SOCKET_URL, { auth: { token } })

        // after a reconnect, catch up on everything missed while offline
        let connectedBefore = false
        const resync = async () => {
            try {
                fetchConversations()
                const openId = activeIdRef.current
                if (!openId) return

                const data = await getMessages(openId)
                if (activeIdRef.current !== openId) return // switched chats meanwhile

                const current = messagesRef.current
                const known = new Set(current.map(m => String(m._id)))
                const overlaps = data.messages.some(m => known.has(String(m._id)))

                if (current.length && !overlaps) {
                    // offline longer than one page of messages: restart from the latest page
                    setMessages(data.messages)
                    setHasMore(Boolean(data.hasMore))
                } else {
                    setMessages(cur => {
                        const fresh = new Map(data.messages.map(m => [String(m._id), m]))
                        const have = new Set(cur.map(m => String(m._id)))
                        return [
                            ...cur.map(m => fresh.get(String(m._id)) || m),         // refresh status / deletions
                            ...data.messages.filter(m => !have.has(String(m._id)))  // messages missed while offline
                        ]
                    })
                }
                socket.current?.emit('mark_seen', { conversationId: openId })
            } catch (err) {
                console.error('resync failed:', err)
            }
        }

        socket.current.on('connect', () => {
            console.log('connected', socket.current.id)
            if (connectedBefore) resync()
            connectedBefore = true
        })
        socket.current.on('connect_error', (err) => console.log('Connection failed:', err.message))

        socket.current.on("online_users", (onlineIds) => {
            setOnlineUserIds(onlineIds)
        })

        return () => {
            socket.current?.disconnect()
        }
    }, [token])

    useEffect(() => {
        if (conversations.length === 0) return
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
            setOnlineUserIds(prev => prev.includes(data.userId) ? prev : [...prev, data.userId])
            setConversations(prev =>
                prev.map(conv =>
                    conv._id === data.userId ? { ...conv, online: true, lastSeen: null } : conv
                )
            )
        }

        const offlineHandler = (data) => {
            setOnlineUserIds(prev => prev.filter(id => id !== data.userId))
            setConversations(prev =>
                prev.map(conv =>
                    conv._id === data.userId ? { ...conv, online: false, lastSeen: data.lastSeen } : conv
                )
            )
        }

        // receipts for MY messages: { conversationId, updates: [{ messageId, status, deliveredCount, readCount, recipientCount }] }
        const receiptsHandler = ({ conversationId, updates }) => {
            const byId = new Map(updates.map(u => [String(u.messageId), u]))

            setMessages(prev =>
                prev.map(msg => {
                    const u = byId.get(String(msg._id))
                    return u ? {
                        ...msg,
                        status: u.status,
                        deliveredCount: u.deliveredCount,
                        readCount: u.readCount,
                        recipientCount: u.recipientCount
                    } : msg
                })
            )
            setConversations(prev =>
                prev.map(conv => {
                    if (String(conv.conversationId) !== String(conversationId)) return conv
                    const u = byId.get(String(conv.lastMessageId))
                    return u ? { ...conv, lastMessageStatus: u.status } : conv
                })
            )
        }

        // message_deleted: { conversationId, messageId, scope, affectedReplyIds? }
        const deletedHandler = ({ conversationId, messageId, scope, affectedReplyIds = [] }) => {
            if (scope === 'everyone') {
                const affectedSet = new Set(affectedReplyIds.map(String))
                // Replace the deleted bubble with a placeholder; update any loaded reply quotes
                setMessages(prev =>
                    prev.map(msg => {
                        if (String(msg._id) === String(messageId)) {
                            return {
                                ...msg,
                                isDeleted: true,
                                content: 'This message was deleted',
                                caption: '',
                                attachment: undefined,
                                type: 'text'
                            }
                        }
                        // Mark quote blocks pointing at the deleted message as stale
                        if (affectedSet.size > 0 && affectedSet.has(String(msg._id)) && msg.replyTo) {
                            return {
                                ...msg,
                                replyTo: { ...msg.replyTo, deleted: true, preview: '' }
                            }
                        }
                        return msg
                    })
                )
            } else if (scope === 'me') {
                // Remove it from the list entirely for this user
                setMessages(prev => prev.filter(msg => String(msg._id) !== String(messageId)))
            }
        }

        // conversation_updated: sidebar repair after a delete
        const convUpdatedHandler = ({ conversationId, lastMessage, lastMessageId, lastMessageTime }) => {
            setConversations(prev =>
                prev.map(conv =>
                    String(conv.conversationId) === String(conversationId)
                        ? {
                            ...conv,
                            lastMessage: lastMessage === undefined ? conv.lastMessage : lastMessage,
                            lastMessageId: lastMessageId === undefined ? conv.lastMessageId : lastMessageId,
                            lastMessageTime: lastMessageTime
                                ? new Date(lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : conv.lastMessageTime
                        }
                        : conv
                )
            )
        }

        socket.current.on("receive_message", receiveHandler)
        socket.current.on("typing", typingHandler)
        socket.current.on("user_online", onlineHandler)
        socket.current.on("user_offline", offlineHandler)
        socket.current.on("message_receipts", receiptsHandler)
        socket.current.on("message_deleted", deletedHandler)
        socket.current.on("conversation_updated", convUpdatedHandler)

        return () => {
            socket.current.off("receive_message", receiveHandler)
            socket.current.off("typing", typingHandler)
            socket.current.off("user_online", onlineHandler)
            socket.current.off("user_offline", offlineHandler)
            socket.current.off("message_receipts", receiptsHandler)
            socket.current.off("message_deleted", deletedHandler)
            socket.current.off("conversation_updated", convUpdatedHandler)
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
        setReplyTo(null)

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
        setReplyTo(null)
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
                lastMessageSender: message.sender?._id || message.sender,
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
    const sendMessage = (text, conversationId, receiverId, attachment = null, replyToId = null) => {
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
                clientMsgId,
                replyToId
            }, (err, res) => {
                if (err) return resolve({ ok: false, error: 'Server did not respond, try again' })
                resolve(res)
            })

            socket.current.emit('typing', { receiver: receiverId, typing: false })
        })
    }

    // --- delete a message ---
    // returns Promise<{ ok, error? }>
    const deleteMessage = (messageId, scope) => {
        if (!socket.current) return Promise.resolve({ ok: false, error: 'Not connected' })
        return new Promise((resolve) => {
            socket.current.timeout(10000).emit('delete_message', { messageId, scope }, (err, res) => {
                if (err) return resolve({ ok: false, error: 'Server did not respond' })
                resolve(res)
            })
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
        replyTo,
        setReplyTo,
        openConversation,
        closeConversation,
        loadOlderMessages,
        sendMessage,
        deleteMessage,
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