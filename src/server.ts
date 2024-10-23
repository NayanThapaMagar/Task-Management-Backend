import express from 'express';
import connectDB from './config/db';
import dotenv from 'dotenv';
import cors from 'cors';
import http from 'http'; // Import http module
import { Server } from 'socket.io'; // Import Socket.IO
import authRoutes from './routes/authRoutes';
import taskRoutes from './routes/taskRoutes';
import subtaskRoutes from './routes/subtaskRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);
const io = new Server(server); // Initialize Socket.IO

// Middleware
app.use(cors());
app.use(express.json());

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('New client connected');

    // Example of listening to an event
    socket.on('taskUpdate', (data) => {
        // Handle task update logic
        console.log('Task updated:', data);
        // Emit event to all clients
        io.emit('taskUpdated', data);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Routes
app.use('/auth', authRoutes);
app.use('/tasks', taskRoutes);
app.use('/subtasks', subtaskRoutes);


// Start Server
server.listen(PORT, () => { // Start HTTP server
    console.log(`Server running on port ${PORT}`);
    connectDB();
});
