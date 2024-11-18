import express from 'express';
import {
    getAllNotifications,
    markNotificationAsRead,
    markNotificationAsUnread,
    markAllNotificationsRead,
    deleteNotification,
} from '../controllers/notificationController';
import { authenticateUser } from '../middlewares/authMiddleware';

const router = express.Router();

router.get('/', authenticateUser, getAllNotifications); 
router.patch('/:notificationId/read', authenticateUser, markNotificationAsRead); 
router.patch('/:notificationId/unread', authenticateUser, markNotificationAsUnread); 
router.put('/markAllRead', authenticateUser, markAllNotificationsRead); 
router.delete('/:notificationId', authenticateUser, deleteNotification);

export default router;
