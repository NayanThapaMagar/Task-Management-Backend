import Notification from '../models/notificationModel';
import mongoose, { Types } from 'mongoose';
import { io } from '../server';
import { userSockets } from '../config/socket'

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

        const newNotification = await Notification.findById(notification._id).populate({
            path: 'originatorId',
            select: 'username email',
        }).populate('taskId').populate('subtaskId').session(session);

        const socketId = userSockets[recipientId.toString()];

        if (socketId && newNotification) {
            io.to(socketId).emit('newNotification', newNotification.toObject());
        } 

        return { success: true };
    } catch (error) {
        // console.error('Error creating notification:', error);
        return { success: false, error: 'Failed to create notification' };
    }
};
