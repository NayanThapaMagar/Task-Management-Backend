import { Request, Response } from 'express';
import Notification from '../models/notificationModel';

// Get Notifications for a User
export const getUserNotifications = async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { page = 1, limit = 20 } = req.query;

    try {
        // Convert page and limit to numbers
        const pageNumber = parseInt(page as string, 10);
        const limitNumber = parseInt(limit as string, 10);

        // Calculate the number of notifications to skip
        const skip = (pageNumber - 1) * limitNumber;

        // Fetch notifications with pagination
        const notifications = await Notification.find({ userId })
            .sort({ createdAt: -1 }) // Newest first
            .skip(skip)
            .limit(limitNumber); // Limit the number of notifications

        // Count total notifications for pagination info
        const totalNotifications = await Notification.countDocuments({ userId });

        res.status(200).json({
            notifications,
            currentPage: pageNumber,
            totalPages: Math.ceil(totalNotifications / limitNumber),
            totalNotifications,
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching notifications', error });
    }
};


export const markNotificationRead = async (req: Request, res: Response) => {
    const { notificationId } = req.params;
    try {
        const notification = await Notification.findByIdAndUpdate(
            notificationId,
            { isRead: true },
            { new: true }
        );
        if (!notification) {
            res.status(404).json({ message: 'Notification not found' });
            return
        }
        res.status(200).json(notification);
    } catch (error) {
        res.status(500).json({ message: 'Error marking notification as read', error });
    }
};