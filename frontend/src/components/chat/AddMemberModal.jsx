import { useState, useEffect } from 'react';
import { getUsers } from '../../services/user.service';
import { addMembers } from '../../services/group.service';
import { useChat } from '../../context/ChatContext';

const AddMemberModal = ({ isOpen, onClose, conversation }) => {
    const { fetchConversations } = useChat();
    
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // Jab modal band ho toh state reset kar do
    useEffect(() => {
        if (!isOpen) {
            setSearchQuery('');
            setSearchResults([]);
            setSelectedUsers([]);
        }
    }, [isOpen]);

    // Users search karne ka logic
    useEffect(() => {
        if (searchQuery.trim() === '') {
            setSearchResults([]);
            return;
        }
        
        const fetchSearchedUsers = async () => {
            try {
                const data = await getUsers(searchQuery);
                
                // SMART LOGIC: Un users ko filter out kar do jo already group mein hain
                const existingMemberIds = conversation?.participants?.map(p => p._id) || [];
                const filteredUsers = data.users.filter(user => !existingMemberIds.includes(user._id));
                
                setSearchResults(filteredUsers);
            } catch (error) {
                console.error("Failed to fetch users", error);
            }
        };
        
        const delaySearch = setTimeout(() => fetchSearchedUsers(), 300);
        return () => clearTimeout(delaySearch);
    }, [searchQuery, conversation]);

    const handleSelectUser = (user) => {
        if (selectedUsers.find((u) => u._id === user._id)) return;
        setSelectedUsers([...selectedUsers, user]);
        setSearchQuery(''); 
    };

    const handleRemoveUser = (userId) => {
        setSelectedUsers(selectedUsers.filter((u) => u._id !== userId));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (selectedUsers.length < 1) return;

        setIsLoading(true);
        try {
            const newMemberIds = selectedUsers.map(user => user._id);
            // Yahan backend ki addMembers API call ho rahi hai
            await addMembers(conversation.conversationId, newMemberIds);
            
            await fetchConversations(); // Sidebar aur Group Info dono update ho jayenge
            onClose(); // Modal band kar do
        } catch (error) {
            console.error("Failed to add members", error);
            alert(error.response?.data?.message || "Failed to add members");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-96 p-6 shadow-xl animate-fade-in-up">
                <h2 className="text-xl font-bold mb-4">Add Members</h2>
                
                <form onSubmit={handleSubmit}>
                    {/* Selected Users Pills */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        {selectedUsers.map(user => (
                            <span key={user._id} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                {user.name}
                                <button type="button" onClick={() => handleRemoveUser(user._id)} className="text-blue-600 hover:text-blue-900 font-bold">&times;</button>
                            </span>
                        ))}
                        {selectedUsers.length === 0 && (
                            <span className="text-xs text-gray-400 italic">No users selected</span>
                        )}
                    </div>

                    {/* Search Users Input */}
                    <input
                        type="text"
                        placeholder="Search users to add..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 mb-2 outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    {/* Search Results Dropdown */}
                    <div className="max-h-40 overflow-y-auto mb-4 border rounded-lg">
                        {searchResults.length === 0 && searchQuery.trim() !== '' ? (
                            <div className="p-3 text-center text-sm text-gray-500">No new users found</div>
                        ) : (
                            searchResults.map(user => (
                                <div 
                                    key={user._id} 
                                    onClick={() => handleSelectUser(user)}
                                    className="p-2 border-b cursor-pointer hover:bg-gray-50 flex items-center gap-3 transition"
                                >
                                    <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">
                                        {user.name.charAt(0)}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">{user.name}</span>
                                        <span className="text-[10px] text-gray-400">{user.email}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={isLoading || selectedUsers.length === 0}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-blue-700 transition"
                        >
                            {isLoading ? 'Adding...' : 'Add to Group'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddMemberModal;