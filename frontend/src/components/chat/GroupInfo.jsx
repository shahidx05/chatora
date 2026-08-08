import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { leaveGroup, removeMember, manageAdmin } from '../../services/group.service';

const GroupInfo = ({ conversation, onClose }) => {
    console.log(conversation)
    const { user: currentUser } = useAuth();
    const { fetchConversations, closeConversation } = useChat();

    const isAdmin = conversation?.groupAdmins?.some(
        admin => String(admin._id) === String(currentUser._id)
    );

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
            <div className="h-20 flex items-center gap-4 px-6 border-b bg-gray-50">
                <button onClick={onClose} className="text-gray-500 hover:text-gray-800 font-bold text-xl">&times;</button>
                <h2 className="font-semibold text-lg">Group Info</h2>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Group Icon & Name */}
                <div className="flex flex-col items-center">
                    <div className="w-24 h-24 rounded-full bg-blue-600 text-white flex items-center justify-center text-4xl font-semibold mb-3">
                        {conversation.name?.charAt(0).toUpperCase()}
                    </div>
                    <h3 className="text-xl font-bold">{conversation.name}</h3>
                    <p className="text-sm text-gray-500">Group · {conversation.participants?.length || 0} members</p>
                </div>

                {/* Members List */}
                <div>
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="text-sm font-semibold text-gray-500 uppercase">Members</h4>
                        {isAdmin && (
                            <button className="text-blue-600 text-sm hover:underline">+ Add</button>
                        )}
                    </div>

                    <div className="space-y-3">
                        {conversation.participants?.map(member => {
                            const isMemberAdmin = conversation?.groupAdmins?.some(
                                admin => String(admin._id) === String(member._id)
                            );
                            const isMe = String(member._id) === String(currentUser._id);

                            return (
                                <div key={member._id} className="flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-white font-medium">
                                            {member.name?.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">
                                                {member.name} {isMe && "(You)"}
                                            </p>
                                            {isMemberAdmin && <span className="text-[10px] text-green-600 border border-green-200 bg-green-50 px-1.5 rounded">Admin</span>}
                                        </div>
                                    </div>

                                    {/* Admin Actions (Only visible if YOU are admin, and not looking at yourself) */}
                                    {isAdmin && !isMe && (
                                        <div className="hidden group-hover:flex gap-2">
                                            <button
                                                onClick={() => handleAdminToggle(member._id, isMemberAdmin)}
                                                className="text-[10px] bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded"
                                            >
                                                {isMemberAdmin ? "Demote" : "Make Admin"}
                                            </button>
                                            <button
                                                onClick={() => handleRemoveMember(member._id)}
                                                className="text-[10px] text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1 rounded"
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
                <div className="pt-4 border-t border-gray-100">
                    <button
                        onClick={handleLeaveGroup}
                        className="w-full flex items-center gap-3 text-red-600 hover:bg-red-50 p-3 rounded-lg transition"
                    >
                        <span className="font-medium">Leave Group</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GroupInfo;