import api from '../api/axios';

export const getConversations = async () => {
  const response = await api.get('/conversations');
  return response.data;
}