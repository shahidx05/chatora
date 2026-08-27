require('dotenv').config()
const http = require('node:http');
const { Server } = require('socket.io');
const app = require('./src/app');
const connectDB = require('./src/config/db');
const initSocket = require('./src/sockets/socket');
const { setIO } = require('./sockets/socketRegistry');
const port = process.env.PORT || 3000;

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true
    }
});
    
setIO(io);
connectDB();
initSocket(io);

server.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
});