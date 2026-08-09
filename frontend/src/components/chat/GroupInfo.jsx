import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { leaveGroup, removeMember, manageAdmin, updateGroup } from '../../services/group.service';
import AddMemberModal from './AddMemberModal';

const GroupInfo = ({ conversation, onClose }) => {
    const { user: currentUser } = useAuth();
    const { fetchConversations, closeConversation } = useChat();

    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(conversation.name || "");
    const [editDesc, setEditDesc] = useState(conversation.description || "");
    const [isLoading, setIsLoading] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const isAdmin = conversation?.groupAdmins?.some(
        admin => String(admin._id) === String(currentUser._id)
    );

    const handleUpdateGroup = async () => {
        if (!editName.trim()) return;
        setIsLoading(true);
        try {
            await updateGroup(conversation.conversationId, {
                groupName: editName,
                groupDescription: editDesc
            });
            setIsEditing(false);
            fetchConversations(); // Refresh the UI
        } catch (error) {
            console.error("Failed to update group info", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLeaveGroup = async () => {
        if (!window.confirm("Are you sure you want to leave this group?")) return;
        try {
            await leaveGroup(conversation.conversationId);
            closeConversation();
            fetchConversations();
        } catch (error) {
            console.error("Failed to leave group", error);
        }
    };

    const handleRemoveMember = async (userId) => {
        if (!window.confirm("Remove this member?")) return;
        try {
            await removeMember(conversation.conversationId, userId);
            fetchConversations();
        } catch (error) {
            console.error("Failed to remove member", error);
        }
    };

    const handleAdminToggle = async (userId, isCurrentlyAdmin) => {
        const action = isCurrentlyAdmin ? 'demote' : 'promote';
        try {
            await manageAdmin(conversation.conversationId, userId, action);
            fetchConversations();
        } catch (error) {
            console.error("Failed to change admin role", error);
            alert(error.response?.data?.message || "Failed to update role");
        }
    };

    return (
        <div className="w-80 border-l bg-white flex flex-col h-full shadow-lg z-10 animate-fade-in-right">
            {/* Header */}
            <div className="h-20 flex items-center gap-4 px-6 border-b bg-gray-50 shrink-0">
                <button onClick={onClose} className="text-gray-500 hover:text-gray-800 font-bold text-xl">&times;</button>
                <h2 className="font-semibold text-lg">Group Info</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Group Icon, Name & Description */}
                <div className="flex flex-col items-center">
                    <div className="w-24 h-24 rounded-full bg-blue-600 text-white flex items-center justify-center text-4xl font-semibold mb-4 shadow-sm">
                        {conversation.name?.charAt(0).toUpperCase()}
                    </div>

                    {isEditing ? (
                        <div className="w-full space-y-3 bg-gray-50 p-3 rounded-lg border">
                            <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:border-blue-500"
                                placeholder="Group Subject"
                            />
                            <textarea
                                value={editDesc}
                                onChange={(e) => setEditDesc(e.target.value)}
                                className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:border-blue-500 resize-none h-20"
                                placeholder="Add group description..."
                            />
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-200 rounded">Cancel</button>
                                <button onClick={handleUpdateGroup} disabled={isLoading} className="px-3 py-1.5 text-xs bg-blue-600 text-white hover:bg-blue-700 rounded">
                                    {isLoading ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center w-full relative group">
                            <h3 className="text-xl font-bold flex justify-center items-center gap-2">
                                {conversation.name}
                                {isAdmin && (
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Edit Group Info"
                                    >
                                        ✏️
                                    </button>
                                )}
                            </h3>

                            {/* Group Description Text */}
                            <div className="mt-2 text-sm text-gray-600 italic">
                                {conversation.description ? (
                                    <p>{conversation.description}</p>
                                ) : (
                                    <p className="text-gray-400">No description provided.</p>
                                )}
                            </div>

                            <p className="text-xs text-gray-400 mt-3 font-medium tracking-wide">
                                GROUP · {conversation.participants?.length || 0} MEMBERS
                            </p>
                        </div>
                    )}
                </div>

                {/* Members List */}
                {/* ... Tumhara purana members list wala div yahan rahega ... */}
                <div>
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="text-sm font-semibold text-gray-500 uppercase">Members</h4>
                        {isAdmin && (
                            // 👇 3. ONCLICK PAR MODAL OPEN KARO 👇
                            <button
                                onClick={() => {
                                    setIsAddModalOpen(true)
                                    console.log("Add Member Modal Opened")
                                }}
                                className="text-blue-600 text-sm hover:underline font-medium"
                            >
                                + Add
                            </button>
                        )}
                    </div>

                    <div className="space-y-3">
                        {conversation.participants?.map(member => {
                            const isMemberAdmin = conversation?.groupAdmins?.some(
                                admin => String(admin._id) === String(member._id)
                            );
                            const isMe = String(member._id) === String(currentUser._id);

                            return (
                                <div key={member._id} className="flex items-center justify-between group/item">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-white font-medium">
                                            {member.name?.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">
                                                {member.name} {isMe && <span className="text-gray-400 font-normal">(You)</span>}
                                            </p>
                                            {isMemberAdmin && <span className="text-[10px] text-green-700 font-medium border border-green-200 bg-green-50 px-1.5 rounded">Group Admin</span>}
                                        </div>
                                    </div>

                                    {isAdmin && !isMe && (
                                        <div className="hidden group-hover/item:flex gap-1">
                                            <button
                                                onClick={() => handleAdminToggle(member._id, isMemberAdmin)}
                                                className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded border"
                                            >
                                                {isMemberAdmin ? "Demote" : "Make Admin"}
                                            </button>
                                            <button
                                                onClick={() => handleRemoveMember(member._id)}
                                                className="text-[10px] text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1 rounded border border-red-100"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="pt-4 border-t border-gray-100 mt-auto">
                    <button
                        onClick={handleLeaveGroup}
                        className="w-full flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 p-3 rounded-lg transition font-medium border border-transparent hover:border-red-100"
                    >
                        Exit Group
                    </button>
                </div>
            </div>
            <AddMemberModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                conversation={conversation}
            />
        </div>
    );
};

export default GroupInfo;