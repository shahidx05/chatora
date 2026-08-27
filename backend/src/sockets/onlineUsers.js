const onlineUsers = new Map();

const setOnline = (userId, socketId) => onlineUsers.set(userId, socketId);
const setOffline = (userId) => onlineUsers.delete(userId);
const getSocketId = (userId) => onlineUsers.get(userId);
const isOnline = (userId) => onlineUsers.has(userId);
const getAllOnlineUserIds = () => [...onlineUsers.keys()];

module.exports = { setOnline, setOffline, getSocketId, isOnline, getAllOnlineUserIds };