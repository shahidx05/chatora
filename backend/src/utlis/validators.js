const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME = /^[a-zA-Z0-9_.]{3,30}$/;

// returns { error } or { value } with trimmed, type-checked fields
const validateRegister = (body) => {
    const { name, username, email, password } = body || {};

    // plain strings only: an object such as {"$ne": null} would become a query operator (NoSQL injection)
    for (const v of [name, username, email, password]) {
        if (typeof v !== 'string') return { error: 'All fields are required' };
    }

    const clean = { name: name.trim(), username: username.trim(), email: email.trim(), password };

    if (clean.name.length < 2 || clean.name.length > 50) return { error: 'Name must be 2-50 characters' };
    if (!USERNAME.test(clean.username)) return { error: 'Username must be 3-30 characters: letters, numbers, _ or .' };
    if (clean.email.length > 254 || !EMAIL.test(clean.email)) return { error: 'Enter a valid email address' };
    // bcrypt only uses the first 72 bytes, so longer passwords would be silently truncated
    if (clean.password.length < 8) return { error: 'Password must be at least 8 characters' };
    if (Buffer.byteLength(clean.password) > 72) return { error: 'Password is too long (max 72 bytes)' };

    return { value: clean };
};

module.exports = { validateRegister };
