<<<<<<< HEAD
# Medical Appointment System

A professional web-based platform for booking medical appointments, managing doctor-patient interactions, and providing instant AI-powered health advice.

## Features

- **User Authentication:** Secure registration and login for patients and doctors, with session and JWT support.
- **Doctor & Patient Profiles:** Manage personal and professional information, including doctor specialization, experience, and availability.
- **Appointment Booking:** Patients can search for doctors, view availability, and book appointments. Doctors manage their schedules and appointment statuses.
- **Real-Time Appointment Chat:** Secure, time-limited chat between doctor and patient during appointments, with image upload support.
- **AI Chatbot:** Instant medical and mental health advice via a built-in AI chatbot, with conversation history for logged-in users.
- **Message Board:** Community forum for posting questions and replies, supporting anonymous posts.
- **Notifications:** System for notifying users about appointment status and other events (see pseudocode for details).
- **Responsive UI:** Modern, mobile-friendly interface using Bootstrap and custom CSS, with dark mode support.

## Tech Stack

- **Backend:** Node.js, Express.js, Socket.IO
- **Frontend:** HTML, CSS (Bootstrap, custom), JavaScript
- **Database:** MySQL (see `database.sql` for schema)
- **Authentication:** JWT, express-session, bcryptjs
- **File Uploads:** Multer (for chat images)
- **Other:** dotenv, cors

## Database Schema

See [`database.sql`](./database.sql) for full schema. Key tables:
- `users`, `doctors`, `appointments`, `messages`, `replies`, `doctor_availability`, `appointment_chat`, `chatbot_logs`

## API Endpoints

### Authentication (`/api/auth`)
- `POST /register` — Register as patient or doctor
- `POST /login` — Login and receive JWT
- `GET /status` — Check authentication status
- `POST /logout` — Logout
- `POST /update-profile` — Update user profile

### Appointments (`/api/appointments`)
- `GET /my-appointments` — List user's appointments
- `POST /book` — Book a new appointment (patients)
- `PATCH /:appointmentId/status` — Update appointment status (doctors)
- `DELETE /:appointmentId` — Cancel appointment

### Doctors (`/api/doctors`)
- `GET /` — List all doctors
- `GET /:doctorId` — Get doctor details
- `PUT /profile` — Update doctor profile
- `PUT /availability` — Update doctor availability
- `GET /dashboard` — Doctor dashboard data

### Message Board (`/api/messages`)
- `GET /` — List all messages
- `GET /:messageId` — Get message and replies
- `POST /` — Post a new message
- `POST /:messageId/replies` — Reply to a message
- `DELETE /:messageId` — Delete a message

### Chatbot (`/api/chatbot`) ## still working on it
- `POST /message` — Get AI chatbot response
- `GET /history` — Get chat history (authenticated)
- `DELETE /history` — Clear chat history

### Chat Image Upload
- `POST /api/chat/upload-image` — Upload image for appointment chat

## Real-Time Features
- **Appointment Chat:** Uses Socket.IO for real-time messaging between doctor and patient during appointment window.

## Setup & Installation

1. **Clone the repository:**
   ```bash
   git clone <repo-url>
   cd project2.0
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Configure environment:**
   - Copy `.env.example` to `.env` and set your MySQL credentials and secrets (or edit directly in code for local dev).
4. **Setup the database:**
   - Import `database.sql` into your MySQL server:
     ```bash
     mysql -u <user> -p < database.sql
     ```
5. **Run the server:**
   ```bash
   npm run dev
   # or
   npm start
   ```
6. **Access the app:**
   - Open [http://localhost:3000](http://localhost:3000) in your browser.

## Directory Structure

- `server.js` — Main server file
- `routes/` — Express route handlers (auth, appointments, doctors, messages, chatbot)
- `public/` — Static frontend files (HTML, CSS, JS, images)
- `database.sql` — MySQL schema
- `PSEUDOCODE.md` — High-level logic and flow

## Screenshots
_Add screenshots of the main UI pages here_

## License
MIT (or specify your license)

---

_This project is for educational and demonstration purposes. Not for production medical use._ 
=======
# anonymous_mental_health_support_system
>>>>>>> 39fbf8ffd99abafe315f17bfce6383e470d7a921
