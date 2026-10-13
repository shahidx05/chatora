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

const redis = require('../config/redis');

const SOCKETS_PREFIX = 'sockets:';   // sockets:<userId> -> Set of socketIds
const TTL_SECONDS = 60;

// true agar ye user ka pehla socket hai (user abhi online aaya)
// multi use kiya taaki 2 tabs ek saath connect hon to bhi sahi count mile
const setOnline = async (userId, socketId) => {
    const key = `${SOCKETS_PREFIX}${userId}`;
    const results = await redis.multi()
        .sadd(key, socketId)
        .expire(key, TTL_SECONDS)
        .scard(key)
        .exec();
    return results[2][1] === 1;
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
    return remaining === 0;
};

const getSocketIds = async (userId) => redis.smembers(`${SOCKETS_PREFIX}${userId}`);

const isOnline = async (userId) =>
    (await redis.scard(`${SOCKETS_PREFIX}${userId}`)) > 0;

// bahut users ka online status ek saath (ek Redis round trip) -> online wale ka Set
const getOnlineAmong = async (userIds) => {
    if (userIds.length === 0) return new Set();

    const pipeline = redis.pipeline();
    userIds.forEach(id => pipeline.scard(`${SOCKETS_PREFIX}${id}`));
    const results = await pipeline.exec();

    return new Set(userIds.filter((id, i) => results[i][1] > 0));
};

module.exports = { setOnline, refreshOnline, removeSocket, getSocketIds, isOnline, getOnlineAmong };