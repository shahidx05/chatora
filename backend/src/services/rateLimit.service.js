const redis = require('../config/redis');

/**
 * Fixed-window counter in Redis, so the limit is shared by ALL server instances.
 * (A per-process Map would let two instances each allow the full limit.)
 *
 * hit('login:1.2.3.4', 10, 900) -> { allowed, count, retryAfterSec }
 *
 * SET ... NX EX creates the key with its expiry only if it does not exist yet, then INCR counts.
 * Both run in one MULTI, so a crash can never leave a counter without an expiry.
 * If Redis is down we fail OPEN (allow) rather than lock every user out.
 */
const hit = async (key, limit, windowSec) => {
    try {
        const k = `rl:${key}`;
        const results = await redis.multi()
            .set(k, 0, 'EX', windowSec, 'NX')
            .incr(k)
            .ttl(k)
            .exec();
        const count = results[1][1];
        const ttl = results[2][1];
        return { allowed: count <= limit, count, retryAfterSec: ttl > 0 ? ttl : windowSec };
    } catch (err) {
        console.error('rate limiter unavailable, allowing request:', err.message);
        return { allowed: true, count: 0, retryAfterSec: 0 };
    }
};

module.exports = { hit };
