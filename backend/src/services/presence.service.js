const { isOnline } = require('../sockets/onlineUsers');

// Everyone who has <userId> as a contact is subscribed to this room.
// Status changes are emitted to the room instead of to every connected user.
const presenceRoom = (userId) => `presence:${userId}`;

// contacts = the other person in each 1-to-1 conversation (that is what the UI shows a dot for)
const contactIdsFrom = (conversations, userId) => {
    const me = String(userId);
    const ids = new Set();
    for (const conv of conversations) {
        if (conv.isGroup) continue;
        for (const p of conv.participants) {
            if (String(p) !== me) ids.add(String(p));
        }
    }
    return [...ids];
};

// Two users just became contacts (first message of a new 1-to-1 chat).
// Subscribe all their live sockets, on any server instance, to each other's presence.
const linkContacts = async (io, a, b) => {
    const A = String(a);
    const B = String(b);

    io.in(A).socketsJoin(presenceRoom(B));
    io.in(B).socketsJoin(presenceRoom(A));

    // they missed each other's "online" announcement, so tell each side the current state
    if (await isOnline(B)) io.to(A).emit('user_online', { userId: B });
    if (await isOnline(A)) io.to(B).emit('user_online', { userId: A });
};

module.exports = { presenceRoom, contactIdsFrom, linkContacts };
