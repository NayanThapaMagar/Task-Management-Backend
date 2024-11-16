import express from 'express';
import {
    getAllTasks,
    getTaskById,
    getMyTasks,
    getAssignedTasks,
    createTask,
    updateTask,
    updateTaskStatus,
    deleteTask,
    getAllCommentsForTask,
    addCommentToTask,
    editTaskComment,
    deleteTaskComment,
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

// task comments
router.get('/:taskId/comments', authenticateUser, isTaskAdminOrAssignee, getAllCommentsForTask);
router.post('/:taskId/comments', authenticateUser, isTaskAdminOrAssignee, addCommentToTask);
router.put('/:taskId/comments/:commentId', authenticateUser, isTaskAdminOrAssignee, editTaskComment);
router.delete('/:taskId/comments/:commentId', authenticateUser, isTaskAdminOrAssignee, deleteTaskComment);

export default router;
