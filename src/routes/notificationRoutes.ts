import express from 'express';
import {
    getUserNotifications,
    markNotificationRead,
} from '../controllers/notificationController';
import { authenticateUser } from '../middlewares/authMiddleware';

const router = express.Router();

router.get('/', authenticateUser, getUserNotifications);
router.patch('/:notificationId/read', authenticateUser, markNotificationRead);

export default router;
