import { Request, Response } from 'express';
import { Types } from 'mongoose';
import Notification from '../models/notificationModel';

// Helper function for pagination
const getPagination = (page: number, limit: number) => {
    const offset = (page - 1) * limit;
    return { offset, limit };
};

// Validate ObjectId
const isValidObjectId = (id: string): boolean => {
    return Types.ObjectId.isValid(id);
};

// Get All Notifications for a Recipient
export const getAllNotifications = async (req: Request, res: Response) => {
    const { isRead, page = '1', limit = '10' } = req.query as { isRead?: boolean, page?: string; limit?: string };
    const recipientId = new Types.ObjectId(req.user?.id);

    if (!recipientId) {
        res.status(400).json({ message: 'Invalid Request!!' });
        return;
    }

    try {
        const { offset, limit: pageLimit } = getPagination(Number(page), Number(limit));

        const query = { recipientId } as { recipientId: Types.ObjectId, isRead: boolean };

        if (isRead !== undefined) {
            query.isRead = isRead;
        }

        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .skip(offset)
            .limit(pageLimit)
            .populate({
                path: 'originatorId',
                select: 'username email',
            })
            .populate('taskId')
            .populate('subtaskId');

        const totalNotifications = await Notification.countDocuments({ recipientId });

        res.status(200).json({
            notifications,
            totalNotifications,
            page: Number(page),
            totalPages: Math.ceil(totalNotifications / pageLimit),
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching notifications' });
    }
};
// count unseen Notifications for a Recipient
export const getUnSeenNotificationsCount = async (req: Request, res: Response) => {
    const recipientId = new Types.ObjectId(req.user?.id);

    if (!recipientId) {
        res.status(400).json({ message: 'Invalid Request!!' });
        return;
    }

    try {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        const unseenCount = await Notification.countDocuments({
            recipientId,
            isSeen: false,
            createdAt: { $gte: oneMonthAgo },
        });

        res.status(200).json({ count: unseenCount });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching unseen notifications count' });
    }
};

// Mark Notification as Read
export const markNotificationAsRead = async (req: Request, res: Response) => {
    const { notificationId } = req.params;

    if (!isValidObjectId(notificationId)) {
        res.status(400).json({ message: 'Invalid notification' });
        return;
    }

    try {
        const notification = await Notification.findById(notificationId).populate({
            path: 'originatorId',
            select: 'username email',
        }).populate('taskId').populate('subtaskId');

        if (!notification) {
            res.status(404).json({ message: 'Notification not found' });
            return;
        }

        notification.isRead = true;
        await notification.save();

        res.status(200).json({ updatedNotification: notification, message: 'Notification marked as read' });
    } catch (error) {
        res.status(500).json({ message: 'Error marking notification as read' });
    }
};

// Mark Notification as Unread
export const markNotificationAsUnread = async (req: Request, res: Response) => {
    const { notificationId } = req.params;

    if (!isValidObjectId(notificationId)) {
        res.status(400).json({ message: 'Invalid notification' });
        return;
    }

    try {
        const notification = await Notification.findById(notificationId).populate({
            path: 'originatorId',
            select: 'username email',
        }).populate('taskId').populate('subtaskId');

        if (!notification) {
            res.status(404).json({ message: 'Notification not found' });
            return;
        }

        // console.log({ notification });  was testing for notification model validation may be id were not assigned while creation(very less chance),
        // tasks or subtasks were deleted after notifications were created. so may be ignore validation for this case for now.

        notification.isRead = false;
        await notification.save();

        res.status(200).json({ updatedNotification: notification, message: 'Notification marked as unread' });
    } catch (error) {
        // console.log({ error });
        res.status(500).json({ message: 'Error marking notification as unread' });
    }
};

// Mark All Notifications as Read
export const markAllNotificationsRead = async (req: Request, res: Response) => {
    const { page = '1', limit = '10' } = req.query as { page?: string; limit?: string };
    const recipientId = new Types.ObjectId(req.user?.id);

    if (!recipientId) {
        res.status(400).json({ message: 'Invalid Request!!' });
        return;
    }

    try {
        const { offset, limit: pageLimit } = getPagination(Number(page), Number(limit));

        const notificationUpdateResponse = await Notification.updateMany({ recipientId, isRead: false }, { isRead: true });

        if (!notificationUpdateResponse) {
            res.status(500).json({ message: 'Error marking all notifications as read' });
            return;
        }

        const notifications = await Notification.find({ recipientId })
            .sort({ createdAt: -1 })
            .skip(offset)
            .limit(pageLimit)
            .populate({
                path: 'originatorId',
                select: 'username email',
            })
            .populate('taskId')
            .populate('subtaskId');

        if (!notifications) {
            res.status(500).json({ message: 'Error fetching all notifications after marking as read' });
            return;
        }

        res.status(200).json({ updatedNotifications: notifications, message: 'All notifications marked as read' });
    } catch (error) {
        res.status(500).json({ message: 'Error marking all notifications as read' });
    }
};
// Mark All Notifications as Seen
export const markAllNotificationsSeen = async (req: Request, res: Response) => {
    const { page = '1', limit = '10' } = req.query as { page?: string; limit?: string };
    const recipientId = new Types.ObjectId(req.user?.id);

    if (!recipientId) {
        res.status(400).json({ message: 'Invalid Request!!' });
        return;
    }

    try {
        const { offset, limit: pageLimit } = getPagination(Number(page), Number(limit));

        const notificationUpdateResponse = await Notification.updateMany({ recipientId, isSeen: false }, { isSeen: true });

        if (!notificationUpdateResponse) {
            res.status(500).json({ message: 'Error marking all notifications as seen' });
            return;
        }

        const notifications = await Notification.find({ recipientId })
            .sort({ createdAt: -1 })
            .skip(offset)
            .limit(pageLimit)
            .populate({
                path: 'originatorId',
                select: 'username email',
            })
            .populate('taskId')
            .populate('subtaskId');

        if (!notifications) {
            res.status(500).json({ message: 'Error fetching all notifications after marking as seen' });
            return;
        }

        res.status(200).json({ updatedNotifications: notifications, message: 'All notifications marked as seen' });
    } catch (error) {
        res.status(500).json({ message: 'Error marking all notifications as seen' });
    }
};

// Delete Notification
export const deleteNotification = async (req: Request, res: Response) => {
    const { notificationId } = req.params;

    if (!isValidObjectId(notificationId)) {
        res.status(400).json({ message: 'Invalid notification' });
        return;
    }

    try {
        const notification = await Notification.findById(notificationId);
        if (!notification) {
            res.status(404).json({ message: 'Notification not found' });
            return;
        }

        await Notification.deleteOne({ _id: notificationId });

        res.status(200).json({ deletedNotificationId: notificationId, message: 'Notification deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting notification' });
    }
};
