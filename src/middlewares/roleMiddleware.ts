import { Request, Response, NextFunction } from 'express';
import Task from '../models/taskModel';
import Subtask from '../models/subtaskModel';
const mongoose = require('mongoose');

export const isTaskAdmin = async (req: Request, res: Response, next: NextFunction) => {
    const { taskId } = req.params;
    const isValidObjectId = mongoose.Types.ObjectId.isValid(taskId);
    if (!isValidObjectId) {
        res.status(404).json({ message: 'Invalid Request' });
        return;
    }
    const userId = req.user?.id;  // Assuming req.user is populated with the logged-in user

    try {
        const task = await Task.findById(taskId);
        if (!task) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }

        if (task.creator.toString() !== userId) {
            res.status(403).json({ message: 'Access denied: Not the task admin' });
            return;
        }

        next();
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
        return;
    }
};

// export const isTaskAssignee = async (req: Request, res: Response, next: NextFunction) => {
//     const { taskId } = req.params;
//     const isValidObjectId = mongoose.Types.ObjectId.isValid(taskId);
//     if (!isValidObjectId) {
//         res.status(404).json({ message: 'Invalid Request' });
//         return;
//     }
//     const userId = req.user?.id;

//     try {
//         const task = await Task.findById(taskId);
//         if (!task) {
//             res.status(404).json({ message: 'Task not found' });
//             return;
//         }

//         const isAssigned = task.assignedTo.some((id) => id.toString() === userId);
//         if (!isAssigned) {
//             res.status(403).json({ message: 'Access denied: Not assigned to this task' });
//             return;
//         }

//         next();
//     } catch (error) {
//         res.status(500).json({ message: 'Server error' });
//         return;
//     }
// };

export const isTaskAdminOrAssignee = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { taskId } = req.params;
        const isValidObjectId = mongoose.Types.ObjectId.isValid(taskId);
        if (!isValidObjectId) {
            res.status(404).json({ message: 'Invalid Request' });
            return;
        }
        const task = await Task.findById(taskId);

        if (!task) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }
        const userId = req.user?.id;

        // Check if the user is an Admin or the Assignee
        const isAdmin = task.creator.toString() === userId;
        const isAssignee = task.assignedTo.some((id) => id.toString() === userId);

        if (!isAdmin && !isAssignee) {
            res.status(403).json({ message: 'Unauthorized' });
            return;
        }

        next();
    } catch (error) {
        res.status(500).json({ message: 'Internal server error', error });
        return;
    }
};

export const isTaskAdminOrSubtaskAdmin = async (req: Request, res: Response, next: NextFunction) => {
    const { taskId, subtaskId } = req.params;

    // Validate taskId
    const isValidTaskId = mongoose.Types.ObjectId.isValid(taskId);
    if (!isValidTaskId) {
        res.status(404).json({ message: 'Invalid Task ID' });
        return;
    }

    // Validate subtaskId
    const isValidSubtaskId = mongoose.Types.ObjectId.isValid(subtaskId);
    if (!isValidSubtaskId) {
        res.status(404).json({ message: 'Invalid Subtask ID' });
        return;
    }

    const userId = req.user?.id;

    try {
        const task = await Task.findById(taskId);
        if (!task) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }

        const subtask = await Subtask.findById(subtaskId);
        if (!subtask) {
            res.status(404).json({ message: 'Subtask not found' });
            return;
        }

        // Check if the user is the task creator or the subtask creator
        const isTaskAdmin = task.creator.toString() === userId;
        const isSubtaskAdmin = subtask.creator.toString() === userId;

        if (!isTaskAdmin && !isSubtaskAdmin) {
            res.status(403).json({ message: 'Access denied: Not an admin' });
            return;
        }

        next();
    } catch (error) {
        res.status(500).json({ message: 'Internal server error', error });
    }
};

export const isTaskAdminOrSubtaskAdminOrSubtaskAssignee = async (req: Request, res: Response, next: NextFunction) => {
    const { taskId, subtaskId } = req.params;

    // Validate taskId
    const isValidTaskId = mongoose.Types.ObjectId.isValid(taskId);
    if (!isValidTaskId) {
        res.status(404).json({ message: 'Invalid Task ID' });
        return;
    }

    // Validate subtaskId
    const isValidSubtaskId = mongoose.Types.ObjectId.isValid(subtaskId);
    if (!isValidSubtaskId) {
        res.status(404).json({ message: 'Invalid Subtask ID' });
        return;
    }

    const userId = req.user?.id;

    try {
        const task = await Task.findById(taskId);
        if (!task) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }

        const subtask = await Subtask.findById(subtaskId);
        if (!subtask) {
            res.status(404).json({ message: 'Subtask not found' });
            return;
        }

        // Check if the user is the task creator, the subtask creator, or assigned to the subtask
        const isTaskAdmin = task.creator.toString() === userId;
        const isSubtaskAdmin = subtask.creator.toString() === userId;
        const isSubtaskAssignee = subtask.assignedTo.some((id) => id.toString() === userId);

        if (!isTaskAdmin && !isSubtaskAdmin && !isSubtaskAssignee) {
            res.status(403).json({ message: 'Access denied: Not an admin or assignee' });
            return;
        }

        next();
    } catch (error) {
        res.status(500).json({ message: 'Internal server error', error });
    }
};