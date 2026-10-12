import { useRef, useLayoutEffect } from 'react'
import { useChat } from '../../context/ChatContext'
import MessageBubble from './MessageBubble'

const MessageList = ({ messages, isGroupChat, hasMore, loadingOlder, onLoadOlder }) => {
    const { currentUser } = useChat()
    const containerRef = useRef(null)
    // what the list looked like after the previous render
    const prev = useRef({ first: null, last: null, scrollHeight: 0 })
    const myId = String(currentUser?.id || currentUser?._id)

    const loadOlder = () => {
        if (hasMore && !loadingOlder && messages.length > 0) {
            onLoadOlder?.(messages[0]._id)
        }
    }

    useLayoutEffect(() => {
        const el = containerRef.current
        if (!el) return

        const first = messages[0]?._id ?? null
        const last = messages[messages.length - 1]?._id ?? null
        const p = prev.current

        if (p.last === null && last !== null) {
            // chat just opened: jump to the newest message, no animation
            el.scrollTop = el.scrollHeight
        } else if (first !== p.first && last === p.last) {
            // an older page was added on top: keep the same messages in view
            el.scrollTop += el.scrollHeight - p.scrollHeight
        } else if (last !== p.last) {
            // a new message arrived: follow it only if I sent it or I'm already near the bottom
            const lastMsg = messages[messages.length - 1]
            const senderId = String(lastMsg.sender?._id || lastMsg.sender)
            const distanceFromBottom = p.scrollHeight - el.scrollTop - el.clientHeight
            if (senderId === myId || distanceFromBottom < 150) {
                el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
            }
        }

        prev.current = { first, last, scrollHeight: el.scrollHeight }

        // page too short to scroll (big screen): fetch more until it fills or history ends
        if (hasMore && !loadingOlder && el.scrollHeight <= el.clientHeight) loadOlder()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages])

    return (
        <div
            ref={containerRef}
            onScroll={(e) => { if (e.currentTarget.scrollTop < 100) loadOlder() }}
            // we adjust scrollTop ourselves when prepending, so disable the browser's own anchoring
            style={{ overflowAnchor: 'none' }}
            className="flex-1 overflow-y-auto bg-gray-50 px-6 py-5 space-y-4"
        >
            {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400">
                    No messages yet.
                </div>
            ) : (
                <>
                    {loadingOlder && (
                        <div className="text-center text-xs text-gray-400">Loading older messages...</div>
                    )}
                    {!hasMore && !loadingOlder && (
                        <div className="text-center text-xs text-gray-400">Start of conversation</div>
                    )}
                    {messages.map((message) => {
                        // Extract ID safely (whether populated object or string ID)
                        const senderId = message.sender?._id || message.sender;
                        const isMine = String(senderId) === myId;

                        return (
                            <MessageBubble
                                key={message._id}
                                message={message}
                                isMine={isMine}
                                isGroupChat={isGroupChat}
                            />
                        )
                    })}
                </>
            )}
        </div>
    )
}

export default MessageList
