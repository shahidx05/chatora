import api from "../api/axios";

export const createGroupChat = async (groupData) => {
    const response = await api.post('/groups', groupData);
    return response.data;
};