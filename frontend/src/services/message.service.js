import api from "../api/axios";

export const getMessages = async (conversationId) => {
    const response = await api.get(`/messages/${conversationId}`);
    return response.data;
};
