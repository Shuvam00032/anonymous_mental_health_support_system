const express = require('express');
const router = express.Router();
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

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({
            success: false,
            message: 'Please login to access this resource'
        });
    }
    next();
};

// Get all messages
router.get('/', async (req, res) => {
    try {
        const [messages] = await pool.query(`
            SELECT m.*, 
                   IF(m.is_anonymous OR m.user_id IS NULL, 'Anonymous', u.full_name) as author_name,
                   u.role as author_role,
                   (SELECT COUNT(*) FROM replies WHERE message_id = m.id) as reply_count
            FROM messages m
            LEFT JOIN users u ON m.user_id = u.id
            ORDER BY m.created_at DESC
        `);
        
        res.json({
            success: true,
            messages
        });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching messages'
        });
    }
});

// Get message by ID with replies
router.get('/:messageId', async (req, res) => {
    try {
        const { messageId } = req.params;
        
        // Get message details
        const [messages] = await pool.query(`
            SELECT m.*, 
                   IF(m.is_anonymous OR m.user_id IS NULL, 'Anonymous', u.full_name) as author_name,
                   u.role as author_role
            FROM messages m
            LEFT JOIN users u ON m.user_id = u.id
            WHERE m.id = ?
        `, [messageId]);
        
        if (messages.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }
        
        // Get replies
        const [replies] = await pool.query(`
            SELECT r.*, 
                   IF(r.is_anonymous OR r.user_id IS NULL, 'Anonymous', u.full_name) as author_name,
                   u.role as author_role
            FROM replies r
            LEFT JOIN users u ON r.user_id = u.id
            WHERE r.message_id = ?
            ORDER BY r.created_at ASC
        `, [messageId]);
        
        res.json({
            success: true,
            message: {
                ...messages[0],
                replies
            }
        });
    } catch (error) {
        console.error('Error fetching message:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching message details'
        });
    }
});

// Create new message
router.post('/', async (req, res) => {
    try {
        const { title, content, isAnonymous } = req.body;
        let userId = null;
        let anonymous = true;
        if (req.session.user) {
            userId = req.session.user.id;
            anonymous = !!isAnonymous;
        }
        const [result] = await pool.query(
            'INSERT INTO messages (user_id, title, content, is_anonymous) VALUES (?, ?, ?, ?)',
            [userId, title, content, anonymous]
        );
        res.status(201).json({
            success: true,
            message: 'Message posted successfully',
            messageId: result.insertId
        });
    } catch (error) {
        console.error('Error creating message:', error);
        res.status(500).json({
            success: false,
            message: 'Error posting message'
        });
    }
});

// Add reply to message
router.post('/:messageId/replies', async (req, res) => {
    try {
        const { messageId } = req.params;
        const { content } = req.body;
        let userId = null;
        let anonymous = true;
        if (req.session.user) {
            userId = req.session.user.id;
            anonymous = false;
        }
        // Check if message exists
        const [messages] = await pool.query(
            'SELECT * FROM messages WHERE id = ?',
            [messageId]
        );
        if (messages.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }
        const [result] = await pool.query(
            'INSERT INTO replies (message_id, user_id, content, is_anonymous) VALUES (?, ?, ?, ?)',
            [messageId, userId, content, anonymous]
        );
        res.status(201).json({
            success: true,
            message: 'Reply posted successfully',
            replyId: result.insertId
        });
    } catch (error) {
        console.error('Error creating reply:', error);
        res.status(500).json({
            success: false,
            message: 'Error posting reply'
        });
    }
});

// Delete message (only by author or admin)
router.delete('/:messageId', isAuthenticated, async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.session.user.id;
        const userRole = req.session.user.role;
        
        // Check if message exists and user has permission
        const [messages] = await pool.query(
            'SELECT * FROM messages WHERE id = ?',
            [messageId]
        );
        
        if (messages.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }
        
        const message = messages[0];
        
        if (message.user_id !== userId && userRole !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to delete this message'
            });
        }
        
        // Delete message (replies will be deleted automatically due to CASCADE)
        await pool.query(
            'DELETE FROM messages WHERE id = ?',
            [messageId]
        );
        
        res.json({
            success: true,
            message: 'Message deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting message'
        });
    }
});

// Delete reply (only by author or admin)
router.delete('/:messageId/replies/:replyId', isAuthenticated, async (req, res) => {
    try {
        const { messageId, replyId } = req.params;
        const userId = req.session.user.id;
        const userRole = req.session.user.role;
        
        // Check if reply exists and user has permission
        const [replies] = await pool.query(
            'SELECT * FROM replies WHERE id = ? AND message_id = ?',
            [replyId, messageId]
        );
        
        if (replies.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Reply not found'
            });
        }
        
        const reply = replies[0];
        
        if (reply.user_id !== userId && userRole !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to delete this reply'
            });
        }
        
        // Delete reply
        await pool.query(
            'DELETE FROM replies WHERE id = ?',
            [replyId]
        );
        
        res.json({
            success: true,
            message: 'Reply deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting reply:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting reply'
        });
    }
});

module.exports = router; 