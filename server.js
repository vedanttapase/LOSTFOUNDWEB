const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const app = express();
const SECRET_KEY = "LOST_FIND_SECURE_KEY_2026"; 

// --- MIDDLEWARE ---
// This allows your GitHub frontend to communicate with this Render backend
app.use(cors());
app.use(express.json());

// Create uploads folder if it doesn't exist
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static('uploads'));

// Mock Databases (Resets when server restarts)
let users = [];
let items = [];

// --- MULTER CONFIG ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// --- ROUTES ---

// Front Door Route
app.get('/', (req, res) => {
    res.send(`
        <div style="font-family: sans-serif; text-align: center; padding-top: 50px;">
            <h1>LostFound Backend is Live!</h1>
            <p>The server is running correctly. Connect via your GitHub frontend.</p>
            <p style="color: #e91e63;"><b>Ready for API requests.</b></p>
        </div>
    `);
});

// AUTH: Register
app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (users.find(u => u.email === email)) return res.status(400).json({ error: "User already exists" });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = { id: Date.now(), name, email, password: hashedPassword };
    users.push(newUser);
    res.json({ message: "Registered successfully" });
});

// AUTH: Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email);
    if (!user) return res.status(400).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid password" });

    const token = jwt.sign({ userId: user.id, userName: user.name }, SECRET_KEY, { expiresIn: '24h' });
    res.json({ token, userId: user.id, userName: user.name, email: user.email });
});

// ITEMS: Get All
app.get('/api/items', (req, res) => res.json(items));

// ITEMS: Post New
app.post('/api/items', upload.single('photo'), (req, res) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ error: "No token provided" });

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        
        // Dynamic host detection for image URLs (local vs render)
        const protocol = req.protocol;
        const host = req.get('host');
        const imageUrl = req.file ? `${protocol}://${host}/uploads/${req.file.filename}` : null;

        const newItem = {
            id: Date.now(),
            userId: decoded.userId,
            name: req.body.name,
            type: req.body.type,
            description: req.body.description,
            location: req.body.location,
            contact_phone: req.body.contact_phone,
            contact_name: req.body.contact_name,
            photo: imageUrl
        };
        items.push(newItem);
        res.json(newItem);
    } catch (err) { res.status(401).json({ error: "Invalid Session" }); }
});

// ITEMS: Delete
app.delete('/api/items/:id', (req, res) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const itemIndex = items.findIndex(i => i.id == req.params.id);

        if (itemIndex === -1) return res.status(404).json({ error: "Item not found" });

        if (items[itemIndex].userId !== decoded.userId) {
            return res.status(403).json({ error: "Forbidden" });
        }

        items.splice(itemIndex, 1);
        res.json({ message: "Item deleted" });
    } catch (err) { res.status(401).json({ error: "Auth failed" }); }
});

// --- SERVER START ---
const PORT = process.env.PORT || 10000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
