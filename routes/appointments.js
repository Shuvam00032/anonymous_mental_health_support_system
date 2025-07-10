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

// Get all appointments for a user
router.get('/my-appointments', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const userRole = req.session.user.role;
        
        let query;
        let params;
        
        if (userRole === 'doctor') {
            query = `
                SELECT a.*, u.full_name as patient_name, u.email as patient_email
                FROM appointments a
                JOIN users u ON a.patient_id = u.id
                WHERE a.doctor_id = (
                    SELECT id FROM doctors WHERE user_id = ?
                )
                ORDER BY a.appointment_date DESC, a.appointment_time DESC
            `;
            params = [userId];
        } else {
            query = `
                SELECT a.*, d.specialization, u.full_name as doctor_name
                FROM appointments a
                JOIN doctors d ON a.doctor_id = d.id
                JOIN users u ON d.user_id = u.id
                WHERE a.patient_id = ?
                ORDER BY a.appointment_date DESC, a.appointment_time DESC
            `;
            params = [userId];
        }
        
        const [appointments] = await pool.query(query, params);
        
        res.json({
            success: true,
            appointments
        });
    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching appointments'
        });
    }
});

// Book new appointment
router.post('/book', isAuthenticated, async (req, res) => {
    try {
        if (req.session.user.role !== 'patient') {
            return res.status(403).json({
                success: false,
                message: 'Only patients can book appointments.'
            });
        }
        const { doctorId, appointmentDate, appointmentTime, reason } = req.body;
        const patientId = req.session.user.id;
        
        // Check if doctor exists
        const [doctors] = await pool.query(
            'SELECT * FROM doctors WHERE id = ?',
            [doctorId]
        );
        
        if (doctors.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found'
            });
        }
        
        // Check if time slot is available
        const [existingAppointments] = await pool.query(
            'SELECT * FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ? AND status != "cancelled"',
            [doctorId, appointmentDate, appointmentTime]
        );
        
        if (existingAppointments.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'This time slot is already booked'
            });
        }
        
        // Create appointment
        const [result] = await pool.query(
            'INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, reason, status) VALUES (?, ?, ?, ?, ?, "pending")',
            [patientId, doctorId, appointmentDate, appointmentTime, reason]
        );
        
        res.status(201).json({
            success: true,
            message: 'Appointment booked successfully',
            appointmentId: result.insertId
        });
    } catch (error) {
        console.error('Error booking appointment:', error);
        res.status(500).json({
            success: false,
            message: 'Error booking appointment'
        });
    }
});

// Update appointment status (for doctors)
router.patch('/:appointmentId/status', isAuthenticated, async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const { status } = req.body;
        const userId = req.session.user.id;
        
        // Check if user is a doctor
        if (req.session.user.role !== 'doctor') {
            return res.status(403).json({
                success: false,
                message: 'Only doctors can update appointment status'
            });
        }
        
        // Check if appointment exists and belongs to this doctor
        const [appointments] = await pool.query(
            'SELECT * FROM appointments WHERE id = ? AND doctor_id = (SELECT id FROM doctors WHERE user_id = ?)',
            [appointmentId, userId]
        );
        
        if (appointments.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }
        
        // Update status
        await pool.query(
            'UPDATE appointments SET status = ? WHERE id = ?',
            [status, appointmentId]
        );
        
        res.json({
            success: true,
            message: 'Appointment status updated successfully'
        });
    } catch (error) {
        console.error('Error updating appointment status:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating appointment status'
        });
    }
});

// Cancel appointment
router.delete('/:appointmentId', isAuthenticated, async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const userId = req.session.user.id;
        
        // Check if appointment exists and belongs to this user
        const [appointments] = await pool.query(
            'SELECT * FROM appointments WHERE id = ? AND patient_id = ?',
            [appointmentId, userId]
        );
        
        if (appointments.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found'
            });
        }
        
        // Update status to cancelled
        await pool.query(
            'UPDATE appointments SET status = "cancelled" WHERE id = ?',
            [appointmentId]
        );
        
        res.json({
            success: true,
            message: 'Appointment cancelled successfully'
        });
    } catch (error) {
        console.error('Error cancelling appointment:', error);
        res.status(500).json({
            success: false,
            message: 'Error cancelling appointment'
        });
    }
});

// Get available time slots for a doctor
router.get('/available-slots/:doctorId', async (req, res) => {
    try {
        const { doctorId } = req.params;
        const { date } = req.query;
        
        // Get doctor's availability for the day
        const [availability] = await pool.query(
            'SELECT * FROM doctor_availability WHERE doctor_id = ? AND day_of_week = ?',
            [doctorId, new Date(date).toLocaleDateString('en-US', { weekday: 'long' })]
        );
        
        if (availability.length === 0) {
            return res.json({
                success: true,
                availableSlots: []
            });
        }
        
        // Get booked appointments for the day
        const [bookedAppointments] = await pool.query(
            'SELECT appointment_time FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND status != "cancelled"',
            [doctorId, date]
        );
        
        const bookedTimes = bookedAppointments.map(apt => apt.appointment_time);
        
        // Generate available time slots
        const availableSlots = [];
        const startTime = new Date(`2000-01-01T${availability[0].start_time}`);
        const endTime = new Date(`2000-01-01T${availability[0].end_time}`);
        
        for (let time = new Date(startTime); time < endTime; time.setMinutes(time.getMinutes() + 30)) {
            const timeString = time.toTimeString().slice(0, 5);
            if (!bookedTimes.includes(timeString)) {
                availableSlots.push(timeString);
            }
        }
        
        res.json({
            success: true,
            availableSlots
        });
    } catch (error) {
        console.error('Error fetching available slots:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching available slots'
        });
    }
});

// Accept appointment (doctor)
router.patch('/:appointmentId/accept', isAuthenticated, async (req, res) => {
    try {
        if (req.session.user.role !== 'doctor') {
            return res.status(403).json({ success: false, message: 'Only doctors can accept appointments.' });
        }
        const { appointmentId } = req.params;
        const userId = req.session.user.id;
        // Check if appointment is pending and belongs to this doctor
        const [appointments] = await pool.query(
            'SELECT * FROM appointments WHERE id = ? AND doctor_id = (SELECT id FROM doctors WHERE user_id = ?) AND status = "pending"',
            [appointmentId, userId]
        );
        if (appointments.length === 0) {
            return res.status(404).json({ success: false, message: 'Appointment not found or not pending.' });
        }
        await pool.query('UPDATE appointments SET status = "confirmed" WHERE id = ?', [appointmentId]);
        res.json({ success: true, message: 'Appointment accepted.' });
    } catch (error) {
        console.error('Error accepting appointment:', error);
        res.status(500).json({ success: false, message: 'Error accepting appointment' });
    }
});

// Reject appointment (doctor)
router.patch('/:appointmentId/reject', isAuthenticated, async (req, res) => {
    try {
        if (req.session.user.role !== 'doctor') {
            return res.status(403).json({ success: false, message: 'Only doctors can reject appointments.' });
        }
        const { appointmentId } = req.params;
        const userId = req.session.user.id;
        // Check if appointment is pending and belongs to this doctor
        const [appointments] = await pool.query(
            'SELECT * FROM appointments WHERE id = ? AND doctor_id = (SELECT id FROM doctors WHERE user_id = ?) AND status = "pending"',
            [appointmentId, userId]
        );
        if (appointments.length === 0) {
            return res.status(404).json({ success: false, message: 'Appointment not found or not pending.' });
        }
        await pool.query('UPDATE appointments SET status = "rejected" WHERE id = ?', [appointmentId]);
        res.json({ success: true, message: 'Appointment rejected.' });
    } catch (error) {
        console.error('Error rejecting appointment:', error);
        res.status(500).json({ success: false, message: 'Error rejecting appointment' });
    }
});

module.exports = router; 