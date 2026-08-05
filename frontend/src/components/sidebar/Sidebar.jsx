import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'
import { useChat } from '../../context/ChatContext'
import ConversationList from './ConversationList'
import { getUsers } from '../../services/user.service';

const Sidebar = () => {
    const { conversations } = useChat()
    const navigate = useNavigate()

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        if (searchQuery.trim() === '') {
            setIsSearching(false);
            setSearchResults([]);
            return;
        }

        const fetchSearchedUsers = async () => {
            try {
                setIsSearching(true);
                const data = await getUsers(searchQuery);
                setSearchResults(data.users);
            } catch (error) {
                console.error("Failed to fetch users", error);
            }
        };

        const delaySearch = setTimeout(() => fetchSearchedUsers(), 300);
        return () => clearTimeout(delaySearch);
    }, [searchQuery]);

    const handleStartChat = (user) => {
        const existingConv = conversations.find(c => String(c._id) === String(user._id));

        if (existingConv) {
            navigate(`/chat/${existingConv.conversationId}`);
        } else {
            navigate(`/chat/new/${user._id}`, { state: { participant: user } });
        }

        setSearchQuery('');
        setIsSearching(false);
    };

    return (
        <aside className="w-80 bg-white border-r flex flex-col">
            <div className="p-5 border-b">
                <h1
                    className="text-2xl font-bold cursor-pointer"
                    onClick={() => {
                        setSearchQuery('');
                        navigate('/');
                    }}
                >
                    Chat App
                </h1>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search users to chat..."
                    className="mt-4 w-full rounded-lg border px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            {isSearching ? (
                <div className="flex-1 overflow-y-auto bg-gray-50">
                    {searchResults.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">No users found.</div>
                    ) : (
                        searchResults.map(user => (
                            <button
                                key={user._id}
                                onClick={() => handleStartChat(user)}
                                className="w-full flex items-center gap-3 p-4 border-b transition-all hover:bg-gray-100 bg-white text-left"
                            >
                                <div className="w-12 h-12 rounded-full flex-shrink-0 bg-blue-600 text-white flex items-center justify-center font-semibold text-lg">
                                    {user.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h2 className="font-semibold truncate">{user.name}</h2>
                                    <p className="text-sm text-gray-500 truncate">@{user.username}</p>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            ) : (
                <ConversationList
                    conversations={conversations}
                    onSelectConversation={(conv) => navigate(`/chat/${conv.conversationId}`)}
                />
            )}
        </aside>
    )
}

export default Sidebar