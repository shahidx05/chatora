const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const messageRoutes = require('./routes/message.routes');
const conversationRoutes = require('./routes/conversation.routes');
const groupRoutes = require('./routes/group.routes');
const app = express()

app.use(cors({origin: "http://localhost:5173",credentials: true}));
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/groups', groupRoutes);

app.get('/', (req, res) => {
    res.send('Hello World!')
})

module.exports = app