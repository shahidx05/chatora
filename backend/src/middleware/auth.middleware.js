const jwt = require('jsonwebtoken')

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized",
        });
    }

    const token = authHeader.split(' ')[1];

    try { 
        const payload = jwt.verify(token, process.env.JWT_SECRET)
        req.user = payload;
        next()

    } catch (error) {
        res.status(401).json({ success: false, message: "Invalid or expired token", });
    }
}

module.exports = authMiddleware