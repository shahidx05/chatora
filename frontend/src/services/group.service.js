import api from "../api/axios";

export const createGroupChat = async (groupData) => {
    const response = await api.post('/groups', groupData);
    return response.data;
};

export const updateGroup = async (groupId, data) => {
    const response = await api.put(`/groups/${groupId}`, data);
    return response.data;
};

export const addMembers = async (groupId, newMembers) => {
    const response = await api.put(`/groups/${groupId}/add`, { newMembers });
    return response.data;
};

export const removeMember = async (groupId, userIdToRemove) => {
    const response = await api.put(`/groups/${groupId}/remove`, { userIdToRemove });
    return response.data;
};

export const manageAdmin = async (groupId, targetUserId, action) => {
    const response = await api.put(`/groups/${groupId}/admin`, { targetUserId, action });
    return response.data;
};

export const leaveGroup = async (groupId) => {
    const response = await api.put(`/groups/${groupId}/leave`);
    return response.data;
};