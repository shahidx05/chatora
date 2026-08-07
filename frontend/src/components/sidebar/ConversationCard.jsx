import { useAuth } from "../../context/AuthContext";
import MessageStatusIcon from "../common/MessageStatusIcon";

const ConversationCard = ({ conversation, selected, onClick }) => {
    const { user: currentUser } = useAuth();

    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 p-4 border-b transition-all hover:bg-gray-100 ${selected ? "bg-blue-50" : "bg-white"
                }`}
        >
            <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-lg">
                    {/* First letter of the Name (Group Name or User Name) */}
                    {conversation?.name?.charAt(0)?.toUpperCase() || "U"}
                </div>

                {/* Show online dot ONLY for 1-on-1 chats */}
                {!conversation.isGroupChat && conversation?.online && (
                    <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-white"></span>
                )}
            </div>

            <div className="flex-1 min-w-0 text-left">
                <div className="flex justify-between items-center">
                    <h2 className="font-semibold truncate">
                        {conversation?.name}
                        {/* Chhota sa indicator ki yeh group hai */}
                        {conversation?.isGroupChat && <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">Group</span>}
                    </h2>

                    <span className="text-xs text-gray-400">
                        {conversation?.lastMessageTime || ""}
                    </span>
                </div>
                <div className="flex justify-between items-center mt-1">

                    <div className="flex items-center gap-1 min-w-0">
                        {conversation.typing ? (
                            <p className="text-sm text-green-600 italic truncate">
                                Typing...
                            </p>
                        ) : (
                            <>
                                {String(conversation.lastMessageSender) === String(currentUser._id) && (
                                    <MessageStatusIcon
                                        status={conversation.lastMessageStatus}
                                    />
                                )}
                                <p className="text-sm text-gray-500 truncate">
                                    {conversation.lastMessage || "No messages yet"}
                                </p>
                            </>
                        )}
                    </div>

                    {conversation.unreadCount > 0 && (
                        <span className="ml-2 min-w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center px-1">
                            {conversation.unreadCount}
                        </span>
                    )}

                </div>
            </div>
        </button>
    );
};

export default ConversationCard;