const { hit } = require('../services/rateLimit.service');

// Express middleware: rateLimit({ name: 'login', limit: 10, windowSec: 900 })
// Counted per client IP by default. Behind Nginx/Render set TRUST_PROXY=1 so req.ip is the real client.
const rateLimit = ({ name, limit, windowSec, key = (req) => req.ip }) => async (req, res, next) => {
    const result = await hit(`${name}:${key(req)}`, limit, windowSec);
    if (!result.allowed) {
        res.set('Retry-After', String(result.retryAfterSec));
        return res.status(429).json({ success: false, message: 'Too many requests, please try again later' });
    }
    next();
};

module.exports = rateLimit;
