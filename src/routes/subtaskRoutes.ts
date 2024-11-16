import express from 'express';
import {
    createSubtask,
    getAllSubtasksForTask,
    getMySubtasksForTask,
    getAssignedSubtasksForTask,
    getSubtasksBySubtaskId,
    updateSubtask,
    updateSubtaskStatus,
    deleteSubtask,
    addCommentToSubtask,
    getAllCommentsForSubtask,
    editSubtaskComment,
    deleteSubtaskComment,
} from '../controllers/subtaskController';
import { isTaskAdminOrAssignee, isTaskAdminOrSubtaskAdmin, isTaskAdminOrSubtaskAdminOrSubtaskAssignee } from '../middlewares/roleMiddleware';
import { authenticateUser } from '../middlewares/authMiddleware';

const router = express.Router();

// Get subtasks
router.get('/:taskId', authenticateUser, isTaskAdminOrAssignee, getAllSubtasksForTask);
router.get('/:taskId/my-subtasks', authenticateUser, isTaskAdminOrAssignee, getMySubtasksForTask);
router.get('/:taskId/assigned-subtasks', authenticateUser, isTaskAdminOrAssignee, getAssignedSubtasksForTask);
router.get('/:taskId/:subtaskId', authenticateUser, isTaskAdminOrSubtaskAdminOrSubtaskAssignee, getSubtasksBySubtaskId);

// subtask
router.post('/:taskId', authenticateUser, isTaskAdminOrAssignee, createSubtask);
router.put('/:taskId/:subtaskId', authenticateUser, isTaskAdminOrSubtaskAdmin, updateSubtask);
router.delete('/:taskId/:subtaskId', authenticateUser, isTaskAdminOrSubtaskAdmin, deleteSubtask);

router.patch('/:taskId/:subtaskId/status', authenticateUser, isTaskAdminOrSubtaskAdminOrSubtaskAssignee, updateSubtaskStatus);

// subtask commnets
router.get('/:taskId/:subtaskId/comments', authenticateUser, isTaskAdminOrSubtaskAdminOrSubtaskAssignee, getAllCommentsForSubtask);
router.post('/:taskId/:subtaskId/comments', authenticateUser, isTaskAdminOrSubtaskAdminOrSubtaskAssignee, addCommentToSubtask);
router.put('/:taskId/:subtaskId/comments/:commentId', authenticateUser, isTaskAdminOrSubtaskAdminOrSubtaskAssignee, editSubtaskComment);
router.delete('/:taskId/:subtaskId/comments/:commentId', authenticateUser, isTaskAdminOrSubtaskAdminOrSubtaskAssignee, deleteSubtaskComment);

export default router;
