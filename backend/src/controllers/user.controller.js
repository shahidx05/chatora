const User = require('../models/User');

exports.getUsers = async (req, res) => {
    try {
        const { id } = req.user;
        const { search } = req.query;

        const filter = {
            _id: { $ne: id },
            ...(search && {
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { username: { $regex: search, $options: 'i' } }
                ]
            })
        };

        const users = await User.find(filter).select("-password");
        res.status(200).json({ success: true, users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};