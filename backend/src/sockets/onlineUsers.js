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

const SOCKETS_PREFIX = 'sockets:';   // sockets:<userId> -> Set of socketIds
const ONLINE_SET = 'online_users';   // Set of userIds
const TTL_SECONDS = 60;

const setOnline = async (userId, socketId) => {
    const key = `${SOCKETS_PREFIX}${userId}`;
    await redis.sadd(key, socketId);
    await redis.expire(key, TTL_SECONDS);
    await redis.sadd(ONLINE_SET, userId);
};

// heartbeat: TTL dobara 60s kar do
const refreshOnline = async (userId, socketId) => {
    const key = `${SOCKETS_PREFIX}${userId}`;
    const refreshed = await redis.expire(key, TTL_SECONDS);
    if (!refreshed) await setOnline(userId, socketId);
};

// returns true agar ye last socket tha (user ab poori tarah offline)
const removeSocket = async (userId, socketId) => {
    const key = `${SOCKETS_PREFIX}${userId}`;
    await redis.srem(key, socketId);
    const remaining = await redis.scard(key);
    if (remaining === 0) {
        await redis.srem(ONLINE_SET, userId);
        return true;
    }
    return false;
};

const getSocketIds = async (userId) => redis.smembers(`${SOCKETS_PREFIX}${userId}`);

const isOnline = async (userId) =>
    (await redis.scard(`${SOCKETS_PREFIX}${userId}`)) > 0;

const getAllOnlineUserIds = async () => {
    const ids = await redis.smembers(ONLINE_SET);
    if (ids.length === 0) return [];

    const pipeline = redis.pipeline();
    ids.forEach(id => pipeline.exists(`${SOCKETS_PREFIX}${id}`));
    const results = await pipeline.exec();

    const alive = [], stale = [];
    ids.forEach((id, i) => (results[i][1] === 1 ? alive : stale).push(id));
    if (stale.length) await redis.srem(ONLINE_SET, ...stale);
    return alive;
};

module.exports = { setOnline, refreshOnline, removeSocket, getSocketIds, isOnline, getAllOnlineUserIds };