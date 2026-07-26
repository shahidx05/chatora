import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'
import { getUsers } from '../services/user.service'
import { getMessages } from '../services/message.service'

const ChatContext = createContext({})

export const useChat = () => {
    return useContext(ChatContext);
};

export const ChatProvider = ({ children }) => {
    const { token, user: currentUser } = useAuth()

    const [users, setUsers] = useState([])
    const [selectedUser, setSelectedUser] = useState(null)
    const [messages, setMessages] = useState([])
    const [isTyping, setIsTyping] = useState(false)

    const socket = useRef(null)
    const typingTimeout = useRef(null)

    // --- connection setup ---
    useEffect(() => {
        if (!token) return

        socket.current = io(import.meta.env.VITE_SOCKET_URL, {
            auth: { token }
        })

        socket.current.on('connect', () => {
            console.log('connected', socket.current.id)
        })

        socket.current.on('connect_error', (err) => {
            console.log('Connection failed:', err.message)
        })

        socket.current.on("online_users", (onlineIds) => {
            setUsers(prev =>
                prev.map(user =>
                    onlineIds.includes(user._id)
                        ? { ...user, online: true }
                        : { ...user, online: false }
                )
            );
        })

        return () => {
            socket.current?.disconnect()
        }
    }, [token])

    // --- event listeners that depend on selectedUser ---
    useEffect(() => {
        if (!socket.current) return

        const receiveHandler = (data) => {
            if (!selectedUser) return

            const isIncoming = String(data.sender) === String(selectedUser._id)
            const isOutgoing = String(data.receiver) === String(selectedUser._id)

            if (isIncoming || isOutgoing) {
                setMessages(prev => [...prev, data])
            }

            if (isIncoming) {
                socket.current.emit('mark_seen', { sender: data.sender })
            }
        }

        const typingHandler = (data) => {
            if (selectedUser && String(data.sender) === String(selectedUser._id)) {
                setIsTyping(data.typing)
            }
        }

        const onlineHandler = (data) => {
            setUsers(prev =>
                prev.map(user =>
                    user._id === data.userId
                        ? {
                            ...user,
                            online: true,
                            lastSeen: null
                        }
                        : user
                )
            );

            if (selectedUser?._id === data.userId) {
                setSelectedUser(prev => ({
                    ...prev,
                    online: true,
                    lastSeen: null
                }));
            }
        };

        const offlineHandler = (data) => {
            setUsers(prev =>
                prev.map(user =>
                    user._id === data.userId
                        ? {
                            ...user,
                            online: false,
                            lastSeen: data.lastSeen
                        }
                        : user
                )
            );

            if (selectedUser?._id === data.userId) {
                setSelectedUser(prev => ({
                    ...prev,
                    online: false,
                    lastSeen: data.lastSeen
                }));
            }
        };

        const statusHandler = (data) => {
            setMessages(prev =>
                prev.map(msg =>
                    String(msg._id) === String(data.messageId)
                        ? { ...msg, status: data.status }
                        : msg
                )
            );
        }
        socket.current.on("receive_message", receiveHandler);
        socket.current.on("typing", typingHandler);
        socket.current.on("user_online", onlineHandler);
        socket.current.on("user_offline", offlineHandler);
        socket.current.on("message_status_updated", statusHandler)

        return () => {
            socket.current.off("receive_message", receiveHandler);
            socket.current.off("typing", typingHandler);
            socket.current.off("user_online", onlineHandler);
            socket.current.off("user_offline", offlineHandler);
            socket.current.off("message_status_updated", statusHandler)
        }
    }, [selectedUser])

    useEffect(() => {
        if (!token) return

        const fetchUsers = async () => {
            try {
                const data = await getUsers();
                setUsers(data.users);
            } catch (error) {
                console.error("Error fetching users:", error);
            }
        };

        fetchUsers();
    }, [token]);

    // --- select a user: fetch history + mark seen ---
    const selectUser = async (user) => {
        setSelectedUser(user)
        setIsTyping(false)

        try {
            const data = await getMessages(user._id)
            setMessages(data.messages)
        } catch (error) {
            console.error('Error fetching messages:', error)
        }

        socket.current?.emit('mark_seen', { sender: user._id })
    }


    // --- send a message ---
    const sendMessage = (text) => {
        if (!text.trim() || !selectedUser || !socket.current) return

        socket.current.emit('send_message', {
            receiver: selectedUser._id,
            message: text
        })

        socket.current.emit('typing', {
            receiver: selectedUser._id,
            typing: false
        })
    }

    // --- typing debounce ---
    const handleTyping = () => {
        if (!selectedUser || !socket.current) return

        socket.current.emit("typing", {
            receiver: selectedUser._id,
            typing: true,
        });

        clearTimeout(typingTimeout.current);

        typingTimeout.current = setTimeout(() => {
            socket.current.emit("typing", {
                receiver: selectedUser._id,
                typing: false,
            });
        }, 1000);
    }

    const value = {
        users,
        selectedUser,
        messages,
        isTyping,
        currentUser,
        selectUser,
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