// const onlineUsers = new Map(); // ----------old code use is an in-memory Map 

// Right now, onlineUsers is an in-memory Map living inside one Node process. This works, but has real limits:

// If you restart the server, all presence data is lost
// If you ever run two instances of your backend (for scaling), each instance has its own separate Map — a user connected to instance A is invisible to instance B, so messages/presence break across instances
// Nothing is shared/synced between processes

// const setOnline = (userId, socketId) => onlineUsers.set(userId, socketId);
// const setOffline = (userId) => onlineUsers.delete(userId);
// const getSocketId = (userId) => onlineUsers.get(userId);
// const isOnline = (userId) => onlineUsers.has(userId);
// const getAllOnlineUserIds = () => [...onlineUsers.keys()];


const redis = require('../config/redis'); // ----------new code use redis for online users

const PRESENCE_PREFIX = 'presence:'; // presence:<userId> -> socketId

const setOnline = async (userId, socketId) => {
    await redis.set(`${PRESENCE_PREFIX}${userId}`, socketId);
};

const setOffline = async (userId) => {
    await redis.del(`${PRESENCE_PREFIX}${userId}`);
};

const getSocketId = async (userId) => {
    return await redis.get(`${PRESENCE_PREFIX}${userId}`);
};

const isOnline = async (userId) => {
    const exists = await redis.exists(`${PRESENCE_PREFIX}${userId}`);
    return exists === 1;
};

const getAllOnlineUserIds = async () => {
    const keys = await redis.keys(`${PRESENCE_PREFIX}*`);
    return keys.map(key => key.replace(PRESENCE_PREFIX, ''));
};


module.exports = { setOnline, setOffline, getSocketId, isOnline, getAllOnlineUserIds };