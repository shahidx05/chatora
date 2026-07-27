const UserCard = ({ user, selected, onClick }) => {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 p-4 border-b transition-all hover:bg-gray-100 ${
                selected ? "bg-blue-50" : "bg-white"
            }`}
        >
            <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-lg">
                    {user?.name?.charAt(0) || "U"}
                </div>

                {user?.online && (
                    <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-white"></span>
                )}
            </div>

            <div className="flex-1 min-w-0 text-left">
                <div className="flex justify-between items-center">
                    <h2 className="font-semibold truncate">
                        {user?.name}
                    </h2>

                    <span className="text-xs text-gray-400">
                        {user?.lastMessageTime || ""}
                    </span>
                </div>

                <div className="flex justify-between items-center mt-1">
                    <p className="text-sm text-gray-500 truncate">
                        {user?.lastMessage || "No messages yet"}
                    </p>

                    {user?.unreadCount > 0 && (
                        <span className="ml-2 min-w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center px-1">
                            {user.unreadCount}
                        </span>
                    )}
                </div>
            </div>
        </button>
    );
};

export default UserCard;