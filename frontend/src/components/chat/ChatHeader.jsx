const ChatHeader = ({ conversation }) => {
    if (!conversation) return null;

    return (
        <header className="h-20 bg-white border-b flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
                <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-semibold">
                        {conversation?.name?.charAt(0) || "U"}
                    </div>

                    {conversation?.online && (
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-white"></span>
                    )}
                </div>

                <div>
                    <h2 className="font-semibold text-lg">
                        {conversation?.name}
                    </h2>

                    <p className="text-sm text-gray-500">
                        {conversation?.online
                            ? "Online"
                            : conversation?.lastSeen
                                ? `Last seen ${new Date(conversation.lastSeen).toLocaleString()}`
                                : "Offline"}
                    </p>
                </div>
            </div>
        </header>
    );
};

export default ChatHeader;