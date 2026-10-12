import api from "../api/axios";

// first page: getMessages(id)
// older page: getMessages(id, { before: oldestLoadedMessageId })
export const getMessages = async (conversationId, { before, limit } = {}) => {
    const response = await api.get(`/messages/${conversationId}`, {
        params: { before, limit },
    });
    return response.data;
};
