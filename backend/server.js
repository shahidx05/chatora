require('dotenv').config()
const http = require('node:http');
const { Server } = require('socket.io');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const initSocket = require('./src/sockets/index');
const { setIO } = require('./src/sockets/socketRegistry');
const { createAdapter } = require('@socket.io/redis-adapter');
const redis = require('./src/config/redis');
const port = process.env.PORT || 3000;

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL,
        methods: ["GET", "POST"],
        credentials: true
    }
});

const pubClient = redis.duplicate();  
const subClient = redis.duplicate();

io.adapter(createAdapter(pubClient, subClient));
    
connectDB();
setIO(io);
initSocket(io);

server.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
});