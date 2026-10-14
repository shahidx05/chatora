import { useState, useRef } from 'react'
import { IoDocumentText, IoTrash, IoArrowUndo } from 'react-icons/io5'
import { formatSize } from '../../services/upload.service'
import { useChat } from '../../context/ChatContext'

// Cloudinary resizes on the fly: small, compressed thumbnail in the chat,
// full-size original opens on click
const thumbUrl = (url) =>
    url.replace('/upload/', '/upload/w_480,c_limit,q_auto,f_auto/');

// 1-to-1: Sent / Delivered / Seen. Groups: same, with "2/4" progress until everyone has it.
const receiptLabel = (message, isGroupChat) => {
    const { status, recipientCount: total, deliveredCount, readCount } = message;

    if (status === "seen") return isGroupChat ? "✓✓ Seen by all" : "✓✓ Seen";
    if (isGroupChat && total > 0) {
        if (readCount > 0) return `✓✓ Seen by ${readCount}/${total}`;
        if (status === "delivered") return "✓✓ Delivered";
        if (deliveredCount > 0) return `✓ Delivered to ${deliveredCount}/${total}`;
    }
    if (status === "delivered") return "✓✓ Delivered";
    return "✓ Sent";
};

// Quoted block shown inside a reply bubble
const ReplyQuote = ({ replyTo, isDeleted, onScrollToOriginal }) => {
    const label = isDeleted ? 'Original message deleted' : replyTo.preview || '';
    return (
        <button
            type="button"
            onClick={onScrollToOriginal}
            className="w-full text-left border-l-4 border-blue-400 bg-black/10 rounded-md px-2 py-1 mb-1.5 cursor-pointer hover:bg-black/20 transition"
        >
            <p className="text-[11px] font-semibold opacity-80 truncate">{replyTo.senderName}</p>
            <p className="text-xs opacity-70 truncate italic">{label}</p>
        </button>
    );
};

// Delete confirm dialog
const DeleteDialog = ({ isMine, onClose, onDelete }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
        <div
            className="bg-white rounded-2xl shadow-xl p-6 w-72 flex flex-col gap-4"
            onClick={e => e.stopPropagation()}
        >
            <h3 className="font-semibold text-gray-800 text-base">Delete message?</h3>
            <div className="flex flex-col gap-2">
                {isMine && (
                    <button
                        className="w-full py-2 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition"
                        onClick={() => onDelete('everyone')}
                    >
                        Delete for everyone
                    </button>
                )}
                <button
                    className="w-full py-2 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition"
                    onClick={() => onDelete('me')}
                >
                    Delete for me
                </button>
                <button
                    className="w-full py-2 rounded-xl text-gray-400 hover:text-gray-600 transition text-sm"
                    onClick={onClose}
                >
                    Cancel
                </button>
            </div>
        </div>
    </div>
);

const MessageBubble = ({ message, isMine, isGroupChat, messageRefs }) => {
    const { setReplyTo, deleteMessage, currentUser } = useChat()
    const [showMenu, setShowMenu] = useState(false)
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const bubbleRef = useRef(null)

    if (message.isSystemMessage) {
        return (
            <div className="flex justify-center my-4">
                <div className="bg-gray-200 text-gray-600 text-xs px-4 py-1.5 rounded-full text-center shadow-sm">
                    {message.content}
                </div>
            </div>
        );
    }

    // Deleted for everyone — show muted placeholder
    if (message.isDeleted) {
        return (
            <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-md flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                    <div className="px-4 py-2 rounded-2xl bg-gray-100 border border-dashed border-gray-300">
                        <p className="text-sm text-gray-400 italic">🚫 This message was deleted</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                        <span>{message.createdAt
                            ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : ''}</span>
                    </div>
                </div>
            </div>
        );
    }

    const time = message.createdAt
        ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';

    const senderName = message.sender?.name || "Unknown";
    const attachment = message.attachment;
    const isImage = message.type === 'image' && attachment;
    const isFile = message.type === 'file' && attachment;
    const hasAttachment = isImage || isFile;

    const bubbleColors = isMine
        ? "bg-blue-600 text-white rounded-br-md"
        : "bg-white border rounded-bl-md";

    // Scroll to the original message and briefly highlight it
    const handleScrollToOriginal = () => {
        if (!message.replyTo?.messageId) return;
        const el = messageRefs?.current?.[String(message.replyTo.messageId)];
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-blue-400', 'ring-offset-2');
        setTimeout(() => el.classList.remove('ring-2', 'ring-blue-400', 'ring-offset-2'), 1500);
    };

    const handleReply = () => {
        setReplyTo({
            messageId: message._id,
            senderName: message.sender?.name || 'Unknown',
            preview: message.type === 'image'
                ? 'Photo'
                : message.type === 'file'
                    ? (message.attachment?.originalName || 'File')
                    : (message.content || '').slice(0, 100),
            type: message.type
        });
        setShowMenu(false);
    };

    const handleDelete = async (scope) => {
        setShowDeleteDialog(false);
        await deleteMessage(String(message._id), scope);
    };

    return (
        <>
            {showDeleteDialog && (
                <DeleteDialog
                    isMine={isMine}
                    onClose={() => setShowDeleteDialog(false)}
                    onDelete={handleDelete}
                />
            )}
            <div
                className={`flex items-end gap-1.5 ${isMine ? "justify-end" : "justify-start"} group`}
                ref={el => { if (messageRefs) messageRefs.current[String(message._id)] = el; }}
            >
                {/* My messages: action buttons sit to the LEFT of the bubble */}
                {isMine && (
                    <div className="hidden group-hover:flex items-center gap-1 flex-shrink-0 pb-5">
                        <button
                            title="Reply"
                            onClick={handleReply}
                            className="p-1.5 rounded-full bg-white shadow border text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition"
                        >
                            <IoArrowUndo size={15} />
                        </button>
                        <button
                            title="Delete"
                            onClick={() => setShowDeleteDialog(true)}
                            className="p-1.5 rounded-full bg-white shadow border text-gray-500 hover:text-red-600 hover:bg-red-50 transition"
                        >
                            <IoTrash size={15} />
                        </button>
                    </div>
                )}

                <div className={`max-w-md flex flex-col ${isMine ? "items-end" : "items-start"}`}>

                    {!isMine && isGroupChat && (
                        <span className="text-xs text-blue-600 font-semibold mb-1 ml-2">
                            {senderName}
                        </span>
                    )}

                    <div className={`${hasAttachment ? "p-1.5" : "px-4 py-2"} rounded-2xl break-words ${bubbleColors} transition-all duration-150`}
                        ref={bubbleRef}
                    >
                        {/* Reply quote block — show "Original message deleted" when replyTo.deleted=true */}
                        {message.replyTo && (
                            <ReplyQuote
                                replyTo={message.replyTo}
                                isDeleted={!!message.replyTo.deleted}
                                onScrollToOriginal={handleScrollToOriginal}
                            />
                        )}

                        {isImage && (
                            <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                                <img
                                    src={thumbUrl(attachment.url)}
                                    alt={attachment.originalName || 'image'}
                                    loading="lazy"
                                    width={attachment.width}
                                    height={attachment.height}
                                    style={{
                                        aspectRatio: attachment.width && attachment.height
                                            ? `${attachment.width} / ${attachment.height}` : undefined,
                                    }}
                                    className="max-h-80 w-auto max-w-[260px] rounded-xl bg-gray-200 object-cover"
                                />
                            </a>
                        )}

                        {isFile && (
                            <a
                                href={attachment.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center gap-3 rounded-xl px-3 py-2 ${isMine ? "bg-blue-500" : "bg-gray-100"}`}
                            >
                                <IoDocumentText size={28} />
                                <span className="min-w-0">
                                    <span className="block max-w-[200px] truncate text-sm font-medium">
                                        {attachment.originalName}
                                    </span>
                                    <span className="block text-xs opacity-80">
                                        {(attachment.format || '').toUpperCase()} · {formatSize(attachment.bytes)}
                                    </span>
                                </span>
                            </a>
                        )}

                        {hasAttachment ? (
                            message.caption && (
                                <p className="text-sm leading-relaxed px-2.5 pt-1.5 pb-1">{message.caption}</p>
                            )
                        ) : (
                            <p className="text-sm leading-relaxed">{message.content}</p>
                        )}
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                        <span>{time}</span>

                        {isMine && <span>{receiptLabel(message, isGroupChat)}</span>}
                    </div>
                </div>

                {/* Incoming messages: action buttons sit to the RIGHT of the bubble */}
                {!isMine && (
                    <div className="hidden group-hover:flex items-center gap-1 flex-shrink-0 pb-5">
                        <button
                            title="Reply"
                            onClick={handleReply}
                            className="p-1.5 rounded-full bg-white shadow border text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition"
                        >
                            <IoArrowUndo size={15} />
                        </button>
                        <button
                            title="Delete"
                            onClick={() => setShowDeleteDialog(true)}
                            className="p-1.5 rounded-full bg-white shadow border text-gray-500 hover:text-red-600 hover:bg-red-50 transition"
                        >
                            <IoTrash size={15} />
                        </button>
                    </div>
                )}
            </div>
        </>
    );
};

export default MessageBubble;
