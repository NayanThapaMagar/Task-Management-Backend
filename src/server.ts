import express from 'express';
import connectDB from './config/db';
import dotenv from 'dotenv';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import authRoutes from './routes/authRoutes';
import userConnectionRoutes from './routes/userConnectionRoutes';
import taskRoutes from './routes/taskRoutes';
import subtaskRoutes from './routes/subtaskRoutes';
import notificationRoutes from './routes/notificationRoutes';
import { setupSocket } from './config/socket';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const corsOptions = {
  origin: process.env.REACT_APP_CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
};

// Create HTTP server
const server = http.createServer(app);
export const io = new Server(server, {
  cors: corsOptions,
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json());


// custom socket setup
setupSocket(io);


// Routes
app.use('/auth', authRoutes);
app.use('/connections', userConnectionRoutes);
app.use('/tasks', taskRoutes);
app.use('/subtasks', subtaskRoutes);
app.use('/notifications', notificationRoutes);

// Start Server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  connectDB();
});
