const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Database connection pool
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Shuvam@9386',
    database: 'medical_appointments',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Register new user
router.post('/register', async (req, res) => {
    try {
        const { fullName, username, email, password, userType, specialization, experience, qualification } = req.body;
        
        // Check if user already exists
        const [existingUsers] = await pool.query(
            'SELECT * FROM users WHERE email = ? OR username = ?',
            [email, username]
        );
        
        if (existingUsers.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'User with this email or username already exists'
            });
        }
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // Start transaction
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        
        try {
            // Insert user
            const [userResult] = await connection.query(
                'INSERT INTO users (username, email, password, full_name, role) VALUES (?, ?, ?, ?, ?)',
                [username, email, hashedPassword, fullName, userType]
            );
            
            // If user is a doctor, insert doctor details
            if (userType === 'doctor') {
                await connection.query(
                    'INSERT INTO doctors (user_id, specialization, qualification, experience_years) VALUES (?, ?, ?, ?)',
                    [userResult.insertId, specialization, qualification, experience]
                );
            }
            
            await connection.commit();
            
            res.status(201).json({
                success: true,
                message: 'User registered successfully'
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Error registering user'
        });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        const { email, password, rememberMe } = req.body;
        
        // Find user
        const [users] = await pool.query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );
        
        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        
        const user = users[0];
        
        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        
        // Create JWT token
        const token = jwt.sign(
            { 
                id: user.id,
                role: user.role
            },
            'your_jwt_secret_here',
            { expiresIn: rememberMe ? '7d' : '24h' }
        );
        
        // Set session
        req.session.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.full_name,
            role: user.role
        };
        
        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                fullName: user.full_name,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Error logging in'
        });
    }
});

// Check authentication status
router.get('/status', (req, res) => {
    if (req.session.user) {
        res.json({
            authenticated: true,
            user: req.session.user
        });
    } else {
        res.json({
            authenticated: false
        });
    }
});

// Logout user
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Error logging out'
            });
        }
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    });
});

// Update user profile
router.post('/update-profile', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    const userId = req.session.user.id;
    const { fullName, email, password } = req.body;
    try {
        let updateQuery = 'UPDATE users SET full_name = ?, email = ?';
        let params = [fullName, email];
        if (password && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            updateQuery += ', password = ?';
            params.push(hashedPassword);
        }
        updateQuery += ' WHERE id = ?';
        params.push(userId);
        await pool.query(updateQuery, params);
        // Update session info
        req.session.user.fullName = fullName;
        req.session.user.email = email;
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ success: false, message: 'Error updating profile' });
    }
});

module.exports = router; 