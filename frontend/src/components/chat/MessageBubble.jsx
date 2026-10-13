import { IoDocumentText } from 'react-icons/io5'
import { formatSize } from '../../services/upload.service'

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

const MessageBubble = ({ message, isMine, isGroupChat }) => {
    if (message.isSystemMessage) {
        return (
            <div className="flex justify-center my-4">
                <div className="bg-gray-200 text-gray-600 text-xs px-4 py-1.5 rounded-full text-center shadow-sm">
                    {message.content}
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

    return (
        <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-md flex flex-col ${isMine ? "items-end" : "items-start"}`}>

                {!isMine && isGroupChat && (
                    <span className="text-xs text-blue-600 font-semibold mb-1 ml-2">
                        {senderName}
                    </span>
                )}

                <div className={`${hasAttachment ? "p-1.5" : "px-4 py-2"} rounded-2xl break-words ${bubbleColors}`}>
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
        </div>
    );
};

export default MessageBubble;
