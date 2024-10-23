import Notification from '../models/notificationModel';
import { Types } from 'mongoose';
import { io } from '../server'; // Import Socket.IO instance

// Helper function to create notifications
export const createNotification = async ({
    userId,
    message,
    taskId,
    subtaskId,
}: {
    userId: Types.ObjectId;
    message: string;
    taskId?: Types.ObjectId;
    subtaskId?: Types.ObjectId;
}) => {
    try {
        const notification = new Notification({
            userId,
            message,
            taskId,
            subtaskId,
        });
        await notification.save();

        // Emit the notification to the specific user via Socket.IO
        io.to(userId.toString()).emit('newNotification', notification);
    } catch (error) {
        console.error('Error creating notification:', error);
    }
};
