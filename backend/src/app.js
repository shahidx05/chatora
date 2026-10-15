const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const messageRoutes = require('./routes/message.routes');
const conversationRoutes = require('./routes/conversation.routes');
const groupRoutes = require('./routes/group.routes');
const uploadRoutes = require('./routes/upload.routes');
const app = express()

if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY))

app.use(helmet())
app.use(cors({origin: process.env.CLIENT_URL,credentials: true}));
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/uploads', uploadRoutes);

// used by load balancers / docker healthchecks; shows which instance answered
app.get('/health', (req, res) => {
    res.json({ ok: true, instance: process.env.INSTANCE_ID || 'local' })
})

app.get('/', (req, res) => {
    res.send('Hello World!')
})

module.exports = app