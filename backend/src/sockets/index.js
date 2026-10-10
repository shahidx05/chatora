const jwt = require('jsonwebtoken');
const User = require('../models/User');
const registerPresenceHandlers = require('./handlers/presence.handler');
const registerMessageHandlers = require('./handlers/message.handler');
const registerTypingHandlers = require('./handlers/typing.handler');

const initSocket = (io) => {
     // middleware: runs before every connection is accepted
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token;

            if (!token) {
                return next(new Error('Authentication error: no token'));
            }

            const payload = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(payload.id).select('-password');

            if (!user) {
                return next(new Error('Authentication error: user not found'));
            }

            socket.user = user;
            next();
        } catch (err) {
            next(new Error('Authentication error: invalid token'));
        }
    });

    io.on('connection', async (socket) => {
        await registerPresenceHandlers(io, socket);
        registerMessageHandlers(io, socket);
        registerTypingHandlers(io, socket);

        const all = await io.fetchSockets();
        console.log('Sockets across ALL servers:', all.length);
    });
};

module.exports = initSocket;