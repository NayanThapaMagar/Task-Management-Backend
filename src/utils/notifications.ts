import Notification from '../models/notificationModel';
import mongoose, { Types } from 'mongoose';
import { io } from '../server'; // Import Socket.IO instance

// Helper function to create notifications
export const createNotification = async ({
    session,
    originatorId,
    recipientId,
    message,
    taskId,
    subtaskId,
}: {
    session: mongoose.mongo.ClientSession;
    originatorId: Types.ObjectId;
    recipientId: Types.ObjectId;
    message: string;
    taskId?: Types.ObjectId;
    subtaskId?: Types.ObjectId;
}) => {
    try {
        const notification = new Notification({
            originatorId,
            recipientId,
            message,
            taskId,
            subtaskId,
        });
        await notification.save({ session });

        // Emit the notification to the specific user via Socket.IO
        io.to(recipientId.toString()).emit('newNotification', notification);

        return { success: true };
    } catch (error) {
        console.error('Error creating notification:', error);
        return { success: false, error: 'Failed to create notification' };
    }
};
