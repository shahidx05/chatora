const User = require('../models/User');

// "a.b*" must be searched literally, not interpreted as a regex (regex injection / slow queries)
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.getUsers = async (req, res) => {
    try {
        const { id } = req.user;
        const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 50) : '';

        const filter = { _id: { $ne: id } };
        if (search) {
            const pattern = escapeRegex(search);
            filter.$or = [
                { name: { $regex: pattern, $options: 'i' } },
                { username: { $regex: pattern, $options: 'i' } }
            ];
        }

        // never return the whole user table, and never return emails
        const users = await User.find(filter)
            .select('name username avatar lastSeen')
            .sort({ name: 1 })
            .limit(20)
            .lean();

        res.status(200).json({ success: true, users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
