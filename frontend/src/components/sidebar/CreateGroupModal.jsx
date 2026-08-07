import { useState, useEffect } from 'react';
import { getUsers } from '../../services/user.service';
import { createGroupChat } from '../../services/group.service';
import { useChat } from '../../context/ChatContext';

const CreateGroupModal = ({ isOpen, onClose }) => {
    const { fetchConversations } = useChat(); // Naya group banne par list refresh karne ke liye
    
    const [groupName, setGroupName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // Users search karne ka logic
    useEffect(() => {
        if (searchQuery.trim() === '') {
            setSearchResults([]);
            return;
        }
        const fetchSearchedUsers = async () => {
            try {
                const data = await getUsers(searchQuery);
                setSearchResults(data.users);
            } catch (error) {
                console.error("Failed to fetch users", error);
            }
        };
        const delaySearch = setTimeout(() => fetchSearchedUsers(), 300);
        return () => clearTimeout(delaySearch);
    }, [searchQuery]);

    // User select aur deselect karne ka logic
    const handleSelectUser = (user) => {
        if (selectedUsers.find((u) => u._id === user._id)) return;
        setSelectedUsers([...selectedUsers, user]);
        setSearchQuery(''); // Select hone ke baad search clear kar do
    };

    const handleRemoveUser = (userId) => {
        setSelectedUsers(selectedUsers.filter((u) => u._id !== userId));
    };

    // Form submit karne ka logic
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!groupName || selectedUsers.length < 1) return;

        setIsLoading(true);
        try {
            const participantIds = selectedUsers.map(user => user._id);
            await createGroupChat({ groupName, participants: participantIds });
            
            // Success! Refresh sidebar list and close modal
            await fetchConversations();
            setGroupName('');
            setSelectedUsers([]);
            onClose();
        } catch (error) {
            console.error("Failed to create group", error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-96 p-6 shadow-xl">
                <h2 className="text-xl font-bold mb-4">Create New Group</h2>
                
                <form onSubmit={handleSubmit}>
                    {/* Group Name Input */}
                    <input
                        type="text"
                        placeholder="Group Name"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 mb-4 outline-none focus:ring-2 focus:ring-blue-500"
                        required
                    />

                    {/* Selected Users Pills */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        {selectedUsers.map(user => (
                            <span key={user._id} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                {user.name}
                                <button type="button" onClick={() => handleRemoveUser(user._id)} className="text-blue-600 hover:text-blue-900 font-bold">&times;</button>
                            </span>
                        ))}
                    </div>

                    {/* Search Users to Add */}
                    <input
                        type="text"
                        placeholder="Search users to add..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 mb-2 outline-none"
                    />

                    {/* Search Results Dropdown-ish */}
                    <div className="max-h-32 overflow-y-auto mb-4 border rounded-lg">
                        {searchResults.slice(0, 4).map(user => (
                            <div 
                                key={user._id} 
                                onClick={() => handleSelectUser(user)}
                                className="p-2 border-b cursor-pointer hover:bg-gray-50 flex items-center gap-2"
                            >
                                <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">
                                    {user.name.charAt(0)}
                                </div>
                                <span className="text-sm">{user.name}</span>
                            </div>
                        ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={isLoading || !groupName || selectedUsers.length === 0}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-blue-700"
                        >
                            {isLoading ? 'Creating...' : 'Create Group'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateGroupModal;