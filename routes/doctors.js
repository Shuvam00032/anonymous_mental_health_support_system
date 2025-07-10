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

// Middleware to check if user is a doctor
const isDoctor = (req, res, next) => {
    if (req.session.user.role !== 'doctor') {
        return res.status(403).json({
            success: false,
            message: 'Only doctors can access this resource'
        });
    }
    next();
};

// Get all doctors
router.get('/', async (req, res) => {
    try {
        const [doctors] = await pool.query(`
            SELECT d.*, u.full_name, u.email, d.charges
            FROM doctors d
            JOIN users u ON d.user_id = u.id
            ORDER BY u.full_name
        `);
        
        res.json({
            success: true,
            doctors
        });
    } catch (error) {
        console.error('Error fetching doctors:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching doctors'
        });
    }
});

// Get doctor by ID
router.get('/:doctorId', async (req, res) => {
    try {
        const { doctorId } = req.params;
        
        const [doctors] = await pool.query(`
            SELECT d.*, u.full_name, u.email, d.charges
            FROM doctors d
            JOIN users u ON d.user_id = u.id
            WHERE d.id = ?
        `, [doctorId]);
        
        if (doctors.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }
        
        // Get doctor's availability
        const [availability] = await pool.query(
            'SELECT * FROM doctor_availability WHERE doctor_id = ?',
            [doctorId]
        );
        
        res.json({
            success: true,
            doctor: {
                ...doctors[0],
                availability
            }
        });
    } catch (error) {
        console.error('Error fetching doctor:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching doctor details'
        });
    }
});

// Update doctor profile
router.put('/profile', isAuthenticated, isDoctor, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { specialization, qualification, experience_years, bio, charges } = req.body;
        
        // Update doctor details
        await pool.query(`
            UPDATE doctors d
            JOIN users u ON d.user_id = u.id
            SET d.specialization = ?,
                d.qualification = ?,
                d.experience_years = ?,
                d.bio = ?,
                d.charges = ?
            WHERE u.id = ?
        `, [specialization, qualification, experience_years, bio, charges, userId]);
        
        res.json({
            success: true,
            message: 'Profile updated successfully'
        });
    } catch (error) {
        console.error('Error updating doctor profile:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating profile'
        });
    }
});

// Update doctor availability
router.put('/availability', isAuthenticated, isDoctor, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { availability } = req.body;
        
        // Get doctor ID
        const [doctors] = await pool.query(
            'SELECT id FROM doctors WHERE user_id = ?',
            [userId]
        );
        
        if (doctors.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Doctor profile not found'
            });
        }
        
        const doctorId = doctors[0].id;
        
        // Start transaction
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        
        try {
            // Delete existing availability
            await connection.query(
                'DELETE FROM doctor_availability WHERE doctor_id = ?',
                [doctorId]
            );
            
            // Insert new availability
            for (const slot of availability) {
                await connection.query(
                    'INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)',
                    [doctorId, slot.day_of_week, slot.start_time, slot.end_time]
                );
            }
            
            await connection.commit();
            
            res.json({
                success: true,
                message: 'Availability updated successfully'
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error updating availability:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating availability'
        });
    }
});

// Get doctor's dashboard data
router.get('/dashboard', isAuthenticated, isDoctor, async (req, res) => {
    try {
        const userId = req.session.user.id;
        
        // Get doctor ID
        const [doctors] = await pool.query(
            'SELECT id FROM doctors WHERE user_id = ?',
            [userId]
        );
        
        if (doctors.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Doctor profile not found'
            });
        }
        
        const doctorId = doctors[0].id;
        
        // Get today's appointments
        const [todayAppointments] = await pool.query(`
            SELECT a.*, u.full_name as patient_name
            FROM appointments a
            JOIN users u ON a.patient_id = u.id
            WHERE a.doctor_id = ? AND a.appointment_date = CURDATE()
            ORDER BY a.appointment_time
        `, [doctorId]);
        
        // Get upcoming appointments
        const [upcomingAppointments] = await pool.query(`
            SELECT a.*, u.full_name as patient_name
            FROM appointments a
            JOIN users u ON a.patient_id = u.id
            WHERE a.doctor_id = ? AND a.appointment_date > CURDATE()
            ORDER BY a.appointment_date, a.appointment_time
            LIMIT 5
        `, [doctorId]);
        
        // Get appointment statistics
        const [stats] = await pool.query(`
            SELECT 
                COUNT(*) as total_appointments,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_appointments,
                SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_appointments,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_appointments
            FROM appointments
            WHERE doctor_id = ?
        `, [doctorId]);
        
        res.json({
            success: true,
            dashboard: {
                todayAppointments,
                upcomingAppointments,
                stats: stats[0]
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard data'
        });
    }
});

module.exports = router; 