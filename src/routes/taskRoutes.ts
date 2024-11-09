import express from 'express';
import {
    getAllTasks,
    getTaskById,
    getMyTasks,
    getAssignedTasks,
    createTask,
    updateTask,
    updateTaskStatus,
    addComment,
    deleteTask
} from '../controllers/taskController';
import { isTaskAdmin, isTaskAdminOrAssignee } from '../middlewares/roleMiddleware';
import { authenticateUser } from '../middlewares/authMiddleware';

const router = express.Router();


router.get('/', authenticateUser, getAllTasks);
router.get('/my-tasks', authenticateUser, getMyTasks);
router.get('/assigned-tasks', authenticateUser, getAssignedTasks);
router.get('/:taskId', authenticateUser, isTaskAdminOrAssignee, getTaskById);

router.post('/', authenticateUser, createTask);
router.put('/:taskId', authenticateUser, isTaskAdmin, updateTask);
router.delete('/:taskId', authenticateUser, isTaskAdmin, deleteTask);

router.patch('/:taskId/status', authenticateUser, isTaskAdminOrAssignee, updateTaskStatus);
router.post('/:taskId/comments', authenticateUser, isTaskAdminOrAssignee, addComment);

export default router;
