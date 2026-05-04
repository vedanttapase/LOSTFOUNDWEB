const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const app = express();
const SECRET_KEY = "LOST_FIND_SECURE_KEY_2026"; 

app.use(cors());
app.use(express.json());

// --- VERCEL FIX: REMOVED MKDIR AND LOCAL STORAGE ---
// Vercel does not allow writing to local folders like './uploads'
// Files will now be handled in memory (RAM)

// --- MOCK DATABASES ---
let users = [];
let items = [];

// --- MULTER CONFIG (Updated for Vercel) ---
const storage = multer.memoryStorage(); // Store files in memory instead of disk
const upload = multer({ storage });

// --- AUTH ROUTES ---

app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (users.find(u => u.email === email)) return res.status(400).json({ error: "User already exists" });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = { id: Date.now(), name, email, password: hashedPassword };
    users.push(newUser);
    res.json({ message: "Registered successfully" });
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email);
    if (!user) return res.status(400).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid password" });

    const token = jwt.sign({ userId: user.id, userName: user.name }, SECRET_KEY, { expiresIn: '24h' });
    res.json({ token, userId: user.id, userName: user.name, email: user.email });
});

// --- ITEM ROUTES ---

app.get('/api/items', (req, res) => res.json(items));

app.post('/api/items', upload.single('photo'), (req, res) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ error: "No token provided" });

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        
        // Since we are using MemoryStorage, req.file.buffer contains the file data.
        // For a demo, we will use a placeholder or convert to Base64.
        const photoData = req.file ? `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}` : null;

        const newItem = {
            id: Date.now(),
            userId: decoded.userId,
            name: req.body.name,
            type: req.body.type,
            description: req.body.description,
            location: req.body.location,
            contact_phone: req.body.contact_phone,
            contact_name: req.body.contact_name,
            photo: photoData // Changed from URL to Base64 String
        };
        items.push(newItem);
        res.json(newItem);
    } catch (err) { res.status(401).json({ error: "Invalid Session" }); }
});

app.delete('/api/items/:id', (req, res) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const itemIndex = items.findIndex(i => i.id == req.params.id);

        if (itemIndex === -1) return res.status(404).json({ error: "Item not found" });

        if (items[itemIndex].userId !== decoded.userId) {
            return res.status(403).json({ error: "Forbidden: You are not the owner" });
        }

        items.splice(itemIndex, 1);
        res.json({ message: "Item deleted" });
    } catch (err) { res.status(401).json({ error: "Auth failed" }); }
});

app.listen(3001, () => {
    console.log('Server running on port 3001');
});
