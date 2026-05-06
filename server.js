const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const SECRET_KEY = "LOST_FIND_SECURE_KEY_2026";

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend files
app.use(express.static(path.join(__dirname, '.')));

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ---------------- MOCK DATABASE ----------------
let users = [];
let items = [];

// ---------------- MULTER CONFIG ----------------
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ---------------- AUTH ROUTES ----------------

// Register
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                error: "All fields are required"
            });
        }

        const existingUser = users.find(u => u.email === email);

        if (existingUser) {
            return res.status(400).json({
                error: "User already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = {
            id: Date.now(),
            name,
            email,
            password: hashedPassword
        };

        users.push(newUser);

        res.json({
            success: true,
            message: "Registered successfully"
        });

    } catch (error) {
        res.status(500).json({
            error: "Server error"
        });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = users.find(u => u.email === email);

        if (!user) {
            return res.status(400).json({
                error: "User not found"
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({
                error: "Invalid password"
            });
        }

        const token = jwt.sign(
            {
                userId: user.id,
                userName: user.name
            },
            SECRET_KEY,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            userId: user.id,
            userName: user.name,
            email: user.email
        });

    } catch (error) {
        res.status(500).json({
            error: "Login failed"
        });
    }
});

// ---------------- ITEM ROUTES ----------------

// Get all items
app.get('/api/items', (req, res) => {
    res.json(items);
});

// Add item
app.post('/api/items', upload.single('photo'), (req, res) => {
    try {
        const token = req.headers['authorization'];

        if (!token) {
            return res.status(401).json({
                error: "No token provided"
            });
        }

        const decoded = jwt.verify(token, SECRET_KEY);

        let photoData = null;

        if (req.file) {
            photoData = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        }

        const newItem = {
            id: Date.now(),
            userId: decoded.userId,
            userName: decoded.userName,
            name: req.body.name,
            type: req.body.type,
            description: req.body.description,
            location: req.body.location,
            contact_phone: req.body.contact_phone,
            contact_name: req.body.contact_name,
            photo: photoData,
            createdAt: new Date()
        };

        items.push(newItem);

        res.json({
            success: true,
            item: newItem
        });

    } catch (error) {
        res.status(401).json({
            error: "Invalid session"
        });
    }
});

// Delete item
app.delete('/api/items/:id', (req, res) => {
    try {
        const token = req.headers['authorization'];

        if (!token) {
            return res.status(401).json({
                error: "Unauthorized"
            });
        }

        const decoded = jwt.verify(token, SECRET_KEY);

        const itemIndex = items.findIndex(
            item => item.id == req.params.id
        );

        if (itemIndex === -1) {
            return res.status(404).json({
                error: "Item not found"
            });
        }

        if (items[itemIndex].userId !== decoded.userId) {
            return res.status(403).json({
                error: "Forbidden: You are not the owner"
            });
        }

        items.splice(itemIndex, 1);

        res.json({
            success: true,
            message: "Item deleted"
        });

    } catch (error) {
        res.status(401).json({
            error: "Auth failed"
        });
    }
});

// ---------------- FALLBACK ROUTE ----------------
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ---------------- EXPORT FOR VERCEL ----------------
module.exports = app;
