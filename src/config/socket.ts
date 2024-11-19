import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

interface UserPayload {
    id: string;
    email: string;
}

let userSockets: { [userId: string]: string } = {};

export const setupSocket = (io: Server): void => {
    // Middleware to authenticate sockets
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error: Token not provided'));
        }
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || '') as UserPayload;
            (socket as any).user = decoded;
            userSockets[decoded.id] = socket.id;
            next();
        } catch (err) {
            next(new Error('Authentication error: Invalid token'));
        }
    });

    // Handle connection events
    io.on('connection', (socket: Socket) => {
        const user = (socket as any).user;
        console.log(`User connected: ${user.email}`);


        // Handle disconnection
        socket.on('disconnect', () => {
            delete userSockets[user.id]; 
            console.log(`User disconnected: ${user.email}`);
        });
    });
};

export { userSockets };