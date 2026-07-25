const User = require('../models/User');
const bcrypt = require("bcrypt")
const generateToken = require('../utlis/generateToken');

exports.register = async (req, res) => {
    try {
        const { name, username, email, password} = req.body;

        if (!name || !username || !email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const user = await User.findOne({
            $or: [{ email }, { username }],
        });
        if (user) {
            return res.status(400).json({ message: "User already exists" })
        }

        const hash = await bcrypt.hash(password, 10);

        const newUser = await User.create({
            name,
            username,
            email,
            password: hash,
        })

        const token = generateToken(newUser._id)

        res.status(201).json({
            success: true,
            message: "User registered successfully",
            token,
            user: {
                id: newUser._id,
                name: newUser.name,
                username: newUser.username,
                email: newUser.email,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "email and password required" });
        }

        const user = await User.findOne({ email })
        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        const isMatch = await bcrypt.compare(password, user.password)

        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        const token = generateToken(user._id)

        res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                username: user.username,
                email: user.email,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}

exports.me = async (req, res) => {
    try {
        const userId = req.user.id
        
        const user = await User.findById(userId).select("-password");

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.status(200).json({ success: true, user, });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}