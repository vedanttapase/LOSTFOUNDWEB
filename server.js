const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const SECRET_KEY = "LOST_FIND_SECURE_KEY_2026";

// --- CLOUDINARY CONFIG (For Permanent Image Storage) ---
cloudinary.config({
    cloud_name: 'your_cloud_name', // Get this from Cloudinary Dashboard
    api_key: 'your_api_key',
    api_secret: 'your_api_secret'
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: { folder: 'lost-find-items' }
});
const upload = multer({ storage });

// --- MONGODB CONFIG (For Permanent User/Item Data) ---
const MONGO_URI = "your_mongodb_connection_string"; 
mongoose.connect(MONGO_URI).then(() => console.log("Connected to MongoDB Atlas"));

// Database Schemas
const User = mongoose.model('User', new mongoose.Schema({
    name: String, email: { type: String, unique: true }, password: String
}));

const Item = mongoose.model('Item', new mongoose.Schema({
    userId: String, name: String, type: String, description: String,
    location: String, contact_phone: String, contact_name: String, photo: String
}));

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// --- ROUTES ---
app.get('/', (req, res) => res.send('LostFound Backend is Live and Connected to MongoDB!'));

app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ name, email, password: hashedPassword });
        await user.save();
        res.json({ message: "Registered successfully" });
    } catch (err) { res.status(400).json({ error: "User already exists" }); }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(400).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ userId: user._id, userName: user.name }, SECRET_KEY, { expiresIn: '24h' });
    res.json({ token, userId: user._id, userName: user.name });
});

app.get('/api/items', async (req, res) => {
    const items = await Item.find();
    res.json(items);
});

app.post('/api/items', upload.single('photo'), async (req, res) => {
    const token = req.headers['authorization'];
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const newItem = new Item({
            ...req.body,
            userId: decoded.userId,
            photo: req.file ? req.file.path : null // This is now a permanent Cloudinary URL
        });
        await newItem.save();
        res.json(newItem);
    } catch (err) { res.status(401).json({ error: "Unauthorized" }); }
});

app.delete('/api/items/:id', async (req, res) => {
    const token = req.headers['authorization'];
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const item = await Item.findById(req.params.id);
        if (item.userId !== String(decoded.userId)) return res.status(403).json({ error: "Forbidden" });
        await Item.findByIdAndDelete(req.params.id);
        res.json({ message: "Deleted" });
    } catch (err) { res.status(401).json({ error: "Auth failed" }); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
