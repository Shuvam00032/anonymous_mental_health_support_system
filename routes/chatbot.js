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

const responses = {
    greetings: {
        patterns: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy', 'greetings', 'hola', 'sup', 'yo', 'hai', 'morning', 'evening', 'afternoon'],
        replies: [
            "Hello! I'm here to help you. How are you feeling today? Would you like to talk about what's on your mind? I can help with specific strategies or just listen. What would be most helpful for you right now?",
            "Hi there! I'm your mental health support companion. What would you like to discuss today? I can help with stress, anxiety, or just listen. What's been challenging for you lately?",
            "Welcome! I'm here to support you. What's been challenging for you lately? I can offer coping strategies or just be here to listen. Would you like to try some quick exercises together?",
            "Hello! How are you doing today? I can help you with relaxation techniques, stress management, or emotional support. What would be most helpful? Would you like to start with a quick check-in?",
            "Hi! I'm here to support your mental health journey. What's been on your mind? I can provide coping strategies or just be here to talk. What specific support do you need today?"
        ]
    },
    feelings: {
        patterns: ['sad', 'depressed', 'unhappy', 'feeling down', 'not good', 'terrible', 'awful', 'miserable', 'hopeless', 'lonely', 'alone', 'hurt', 'crying', 'tears', 'blue', 'heartbroken', 'devastated', 'grief', 'mourning', 'lost'],
        replies: [
            "I understand you're feeling down. Let's try something together: 1) Take 3 deep breaths with me 2) Write down 3 things you're grateful for 3) Go for a 5-minute walk. Would you like to try any of these? How long have you been feeling this way? What triggered these feelings?",
            "When you're feeling sad, it's important to be gentle with yourself. Let's do a quick exercise: Name 5 things you can see, 4 things you can touch, 3 things you can hear, 2 things you can smell, and 1 thing you can taste. Would you like to try this? What support do you need right now?",
            "Depression and sadness can be overwhelming. Here are some strategies that might help: 1) Regular exercise 2) Maintaining a sleep schedule 3) Talking to someone you trust. Which of these would you like to try? Have you noticed any patterns in when these feelings occur? What helps you feel better?",
            "It's okay to feel this way. Let's try the 3-3-3 rule: Name 3 things you see, 3 sounds you hear, and move 3 parts of your body. Would you like to try this now? What support do you need right now? Have you tried any coping strategies before?",
            "When feeling lonely, here are some activities that might help: 1) Join an online community 2) Practice self-care 3) Start a gratitude journal 4) Engage in a hobby. Which of these interests you? What kind of support would be most helpful for you? Would you like to create a plan together?"
        ]
    },
    anxiety: {
        patterns: ['anxious', 'worried', 'panic', 'stress', 'overthinking', 'nervous', 'fear', 'scared', 'terrified', 'uneasy', 'restless', 'tense', 'pressure', 'overwhelmed', 'freaking out', 'paranoid', 'phobia', 'afraid'],
        replies: [
            "Let's tackle this anxiety together. Would you like to try a breathing exercise? Breathe in for 4 counts, hold for 4, exhale for 4. Repeat this 4 times. How does that feel? What's causing your anxiety right now? What physical sensations are you experiencing?",
            "For immediate anxiety relief, let's try this: 1) Place your feet firmly on the ground 2) Focus on your breathing 3) Name 5 blue objects you can see. Would you like to try this now? What triggered your anxiety? How intense is your anxiety on a scale of 1-10?",
            "When anxiety hits, try the STOP technique: Stop what you're doing, Take a step back, Observe your thoughts and feelings, Proceed mindfully. Would you like to practice this together? What's the most challenging part of your anxiety? What coping strategies have worked for you before?",
            "Here's a calming technique: Tense each muscle group for 5 seconds, then release. Start from your toes and work up to your head. Would you like to try this? What helps you feel calmer? Have you noticed any patterns in your anxiety?",
            "To manage overthinking: 1) Write your worries down 2) Set a specific 'worry time' each day 3) Challenge negative thoughts 4) Focus on what you can control. Which of these would you like to try? What's your biggest worry right now? Would you like to create a worry management plan?"
        ]
    },
    // ... (other categories from user input, omitted for brevity) ...
};

const defaultResponses = [
    "I understand you're sharing something important. Let's explore this together. What specific aspect would you like to focus on? Here are some general well-being tips: 1) Practice mindful breathing 2) Stay connected with others 3) Maintain a routine 4) Take care of your physical health. Which of these would you like to try? What's your biggest challenge right now?",
    "While I'm here to support you, let's identify what would be most helpful. What's your biggest challenge right now? Remember these key aspects of mental health: Regular exercise, healthy eating, good sleep habits, and staying connected with others. Which area would you like to work on? Would you like to create a specific plan?",
    "Your well-being matters. Let's create a plan together. What's one small step you'd like to take today? Consider these daily practices: 1) Mindfulness exercises 2) Physical activity 3) Creative expression 4) Connecting with supportive people. Which interests you most? What support do you need to get started?",
    "Taking care of your mental health is important. What specific support do you need right now? Try these strategies: 1) Set small, achievable goals 2) Practice self-compassion 3) Maintain social connections 4) Engage in activities you enjoy. Which would you like to explore? Would you like to try one of these together?",
    "Let's focus on what would help you most. What's one thing you'd like to improve? Here are some general wellness tips: 1) Start your day with a positive routine 2) Take regular breaks 3) Practice gratitude 4) Engage in activities that bring you joy 5) Connect with others. Which of these resonates with you? Would you like to create a specific action plan?"
];

function processMessage(message) {
    const lowerMsg = message.toLowerCase();
    for (const key in responses) {
        const { patterns, replies } = responses[key];
        if (patterns.some(pattern => lowerMsg.includes(pattern))) {
            return replies[Math.floor(Math.random() * replies.length)];
        }
    }
    // Default fallback
    return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
}

// Handle chatbot message
router.post('/message', async (req, res) => {
    try {
        const { message } = req.body;
        const userId = req.session.user?.id;
        
        // Generate response
        const response = processMessage(message);
        
        // Log conversation if user is authenticated
        if (userId) {
            await pool.query(
                'INSERT INTO chatbot_logs (user_id, message, response) VALUES (?, ?, ?)',
                [userId, message, response]
            );
        }
        
        res.json({
            success: true,
            response
        });
    } catch (error) {
        console.error('Error processing chatbot message:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing message'
        });
    }
});

// Get chat history for authenticated user
router.get('/history', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.id;
        
        const [logs] = await pool.query(
            'SELECT * FROM chatbot_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
            [userId]
        );
        
        res.json({
            success: true,
            history: logs
        });
    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching chat history'
        });
    }
});

// Clear chat history for authenticated user
router.delete('/history', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.id;
        
        await pool.query(
            'DELETE FROM chatbot_logs WHERE user_id = ?',
            [userId]
        );
        
        res.json({
            success: true,
            message: 'Chat history cleared successfully'
        });
    } catch (error) {
        console.error('Error clearing chat history:', error);
        res.status(500).json({
            success: false,
            message: 'Error clearing chat history'
        });
    }
});

module.exports = router; 