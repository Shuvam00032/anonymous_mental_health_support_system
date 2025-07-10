const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const mysql = require('mysql2');
const mysql2 = require('mysql2/promise');
const multer = require('multer');

const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const PORT = 3000;

// Multer setup for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/chat_images'); // Directory to save uploaded images
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Append timestamp to avoid filename conflicts
    }
});
const upload = multer({ storage: storage });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Ensure upload directory exists
const fs = require('fs');
const uploadDir = path.join(__dirname, 'public/uploads/chat_images');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Session configuration
const sessionStore = new MySQLStore({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'Shuvam@9386',
    database: 'medical_appointments'
});

app.use(session({
    secret: 'your_session_secret_here',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
}));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// New endpoint for image upload
app.post('/api/chat/upload-image', upload.single('chatImage'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    // Respond with the path relative to the public directory
    const imagePath = '/uploads/chat_images/' + req.file.filename;
    res.json({ success: true, imagePath: imagePath });
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/doctors', require('./routes/doctors'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/chatbot', require('./routes/chatbot'));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Something went wrong!',
        error: err.message
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// Socket.IO chat logic
io.on('connection', (socket) => {
    // Join appointment chat room
    socket.on('joinAppointmentChat', async ({ appointmentId, userId }) => {
        // Check if user is doctor or patient for this confirmed appointment and if time is valid
        const chatPool = mysql2.createPool({
            host: 'localhost',
            user: 'root',
            password: 'Shuvam@9386',
            database: 'medical_appointments',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
        const [rows] = await chatPool.query(
            `SELECT a.*, d.user_id as doctor_user_id
             FROM appointments a
             JOIN doctors d ON a.doctor_id = d.id
             WHERE a.id = ? AND a.status = 'confirmed'`,
            [appointmentId]
        );
        if (!rows.length) {
            socket.emit('chatError', 'Invalid or unconfirmed appointment.');
            return;
        }
        const appt = rows[0];
        const now = new Date();
        const apptDate = new Date(appt.appointment_date + 'T' + appt.appointment_time);
        // Allow chat within +/- 15 minutes of appointment time
        const start = new Date(apptDate.getTime() - 15 * 60000);
        const end = new Date(apptDate.getTime() + 45 * 60000);
        if (now < start || now > end) {
            socket.emit('chatError', 'Chat is only available during the appointment time.');
            return;
        }
        if (userId !== appt.patient_id && userId !== appt.doctor_user_id) {
            socket.emit('chatError', 'You are not authorized for this chat.');
            return;
        }
        socket.join('appointment_' + appointmentId);
        // Send chat history
        const [messages] = await chatPool.query(
            'SELECT ac.*, u.full_name FROM appointment_chat ac JOIN users u ON ac.user_id = u.id WHERE ac.appointment_id = ? ORDER BY ac.created_at ASC',
            [appointmentId]
        );
        socket.emit('chatHistory', messages);
    });
    // Handle new chat message
    socket.on('appointmentMessage', async ({ appointmentId, userId, message, image_path }) => {
        // Save message
        const chatPool = mysql2.createPool({
            host: 'localhost',
            user: 'root',
            password: 'Shuvam@9386',
            database: 'medical_appointments',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
        // Insert message and image_path if provided
        await chatPool.query(
            'INSERT INTO appointment_chat (appointment_id, user_id, message, image_path) VALUES (?, ?, ?, ?)',
            [appointmentId, userId, message, image_path || null]
        );
        // Get sender name
        const [[user]] = await chatPool.query('SELECT full_name FROM users WHERE id = ?', [userId]);
        const msgObj = { appointment_id: appointmentId, user_id: userId, message, image_path, created_at: new Date(), full_name: user.full_name };
        io.to('appointment_' + appointmentId).emit('appointmentMessage', msgObj);
    });
});

http.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 