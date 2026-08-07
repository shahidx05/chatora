const MessageBubble = ({ message, isMine, isGroupChat }) => {
    const time = message.createdAt
        ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';

    const senderName = message.sender?.name || "Unknown";

    return (
        <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-md flex flex-col ${isMine ? "items-end" : "items-start"}`}>

                {!isMine && isGroupChat && (
                    <span className="text-xs text-blue-600 font-semibold mb-1 ml-2">
                        {senderName}
                    </span>
                )}

                <div
                    className={`px-4 py-2 rounded-2xl break-words ${isMine
                            ? "bg-blue-600 text-white rounded-br-md"
                            : "bg-white border rounded-bl-md"
                        }`}
                >
                    <p className="text-sm leading-relaxed">
                        {message.content}
                    </p>
                </div>

                <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                    <span>{time}</span>

                    {isMine && !isGroupChat && (
                        <span>
                            {message.status === "seen"
                                ? "✓✓ Seen"
                                : message.status === "delivered"
                                    ? "✓✓ Delivered"
                                    : "✓ Sent"}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MessageBubble;