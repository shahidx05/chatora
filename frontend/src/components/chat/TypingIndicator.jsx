const TypingIndicator = ({ isTyping }) => {
    if (!isTyping) return null;

    return (
        <div className="px-6 py-2 bg-gray-50">

            <div className="inline-flex items-center gap-2 bg-white border rounded-full px-4 py-2 shadow-sm">

                <span className="text-sm text-gray-500">
                    Typing...
                </span>

                <div className="flex gap-1">

                    <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"></span>

                    <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]"></span>

                    <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]"></span>

                </div>

            </div>

        </div>
    );
};

export default TypingIndicator;