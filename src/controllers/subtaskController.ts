import { Request, Response } from 'express';
import Subtask from '../models/subTaskModel';
import Task from '../models/taskModel';
import mongoose, { Types } from 'mongoose';

const validStatuses = ['pending', 'completed'];
const validPriorities = ['low', 'medium', 'high'];

// Admin: Create a Subtask
export const createSubtask = async (req: Request, res: Response) => {
    const { taskId } = req.params;
    try {
        const { title, description, priority, assignedTo } = req.body;
        const isValidObjectId = mongoose.Types.ObjectId.isValid(taskId);
        if (!isValidObjectId) {
            res.status(404).json({ message: 'Invalid Task' });
            return
        }
        const task = await Task.findById(taskId);
        if (!task) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }
        const subtask = await Subtask.create({
            title,
            description,
            priority,
            creator: req.user?.id,
            assignedTo,
            taskId, // Reference to the parent task
        });
        res.status(201).json(subtask);
    } catch (error) {
        res.status(500).json({ message: 'Error creating subtask', error });
    }
};
// Get Subtasks by Task ID
export const getSubtasksBySubtaskId = async (req: Request, res: Response) => {
    const { subtaskId } = req.params;

    const isValidObjectId = mongoose.Types.ObjectId.isValid(subtaskId);
    if (!isValidObjectId) {
        res.status(404).json({ message: 'Invalid Subtask' });
        return
    }

    try {
        const subtask = await Subtask.findById(subtaskId);
        if (!subtask) {
            res.status(404).json({ message: 'Subtask not found' });
            return
        }
        res.status(200).json(subtask); // Return the subtask
    } catch (error) {
        res.status(500).json({ message: 'Error fetching subtask', error });
    }
};
// Admin: Update Subtask Details
export const updateSubtask = async (req: Request, res: Response) => {
    const { subtaskId } = req.params;
    const isValidObjectId = mongoose.Types.ObjectId.isValid(subtaskId);
    if (!isValidObjectId) {
        res.status(404).json({ message: 'Invalid Request' });
        return;
    }
    const { title, description, priority, assignedTo } = req.body;
    const updates = { title, description, priority, assignedTo };
    try {
        const subtask = await Subtask.findByIdAndUpdate(subtaskId, updates, { new: true, runValidators: true });
        if (!subtask) {
            res.status(404).json({ message: 'Subtask not found' });
            return;
        }
        res.status(200).json(subtask);
    } catch (error) {
        res.status(500).json({ message: 'Error updating subtask', error });
    }
};

// Assignee: Update Subtask Status
export const updateSubtaskStatus = async (req: Request, res: Response) => {
    const { subtaskId } = req.params;
    const isValidObjectId = mongoose.Types.ObjectId.isValid(subtaskId);
    if (!isValidObjectId) {
        res.status(404).json({ message: 'Invalid Request' });
        return;
    }
    const { status } = req.body;
    try {
        const subtask = await Subtask.findByIdAndUpdate(
            subtaskId,
            { status },
            { new: true, runValidators: true }
        );
        if (!subtask) {
            res.status(404).json({ message: 'Subtask not found' });
            return;
        }
        res.json(subtask);
    } catch (error) {
        res.status(500).json({ message: 'Error updating subtask status', error });
    }
};

// Assignee: Add Comment to Subtask
export const addCommentToSubtask = async (req: Request, res: Response) => {
    const { subtaskId } = req.params;
    const isValidObjectId = mongoose.Types.ObjectId.isValid(subtaskId);
    if (!isValidObjectId) {
        res.status(404).json({ message: 'Invalid Request' });
        return;
    }
    const { text } = req.body;
    const userId = req.user?.id;

    if (!userId) {
        res.status(400).json({ message: 'User is not authorized to add a comment' });
        return;
    }

    try {
        const subtask = await Subtask.findById(subtaskId);
        if (!subtask) {
            res.status(404).json({ message: 'Subtask not found' });
            return;
        }
        const comment = { userId: new Types.ObjectId(userId), text, createdAt: new Date() };
        subtask.comments.push(comment);
        await subtask.save();
        res.json(subtask);
    } catch (error) {
        res.status(500).json({ message: 'Error adding comment to subtask', error });
    }
};

// Delete Subtask
export const deleteSubtask = async (req: Request, res: Response) => {
    const { subtaskId } = req.params;
    const isValidObjectId = mongoose.Types.ObjectId.isValid(subtaskId);

    if (!isValidObjectId) {
        res.status(404).json({ message: 'Invalid Request' });
        return;
    }

    try {
        const subtask = await Subtask.findById(subtaskId);

        if (!subtask) {
            res.status(404).json({ message: 'Subtask not found' });
            return;
        }

        await subtask.deleteOne();
        res.status(200).json({ message: 'Subtask deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting subtask', error });
    }
};

// Helper function for pagination
const getPagination = (page: number, limit: number) => {
    const offset = (page - 1) * limit;
    return { offset, limit };
};

// Get All Subtasks (for Admin)
export const getAllSubtasksForTask = async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const isValidObjectId = mongoose.Types.ObjectId.isValid(taskId);
    if (!isValidObjectId) {
        res.status(404).json({ message: 'Invalid Request' });
        return;
    }

    const { status, priority, page = '1', limit = '10' } = req.query as {
        status?: string;
        priority?: string;
        page?: number;
        limit?: number;
    };

    const filters: any = { taskId };

    // Validate and set `status`
    if (status && validStatuses.includes(status)) filters.status = status;

    // Validate and set `priority`
    if (priority && validPriorities.includes(priority)) filters.priority = priority;

    try {
        const { offset, limit: pageLimit } = getPagination(Number(page), Number(limit));
        const subtasks = await Subtask.find(filters)
            .skip(offset)
            .limit(pageLimit);

        const totalSubtasks = await Subtask.countDocuments(filters);
        res.status(200).json({ subtasks, totalSubtasks, page: Number(page), totalPages: Math.ceil(totalSubtasks / pageLimit) });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching subtasks', error });
    }
};

// Get Subtasks Created by User
export const getMySubtasksForTask = async (req: Request, res: Response) => {
    const { taskId } = req.params; // Get the task ID from the URL params
    const { status, priority, page = '1', limit = '10' } = req.query as {
        status?: string;
        priority?: string;
        page?: number;
        limit?: number;
    };

    const userId = req.user?.id;
    const isValidObjectId = mongoose.Types.ObjectId.isValid(taskId); // Validate task ID

    if (!isValidObjectId) {
        res.status(404).json({ message: 'Invalid Task ID' });
        return;
    }

    const filters: any = {
        creator: userId,
        taskId: taskId
    };

    // Validate and set `status`
    if (status && validStatuses.includes(status)) filters.status = status;

    // Validate and set `priority`
    if (priority && validPriorities.includes(priority)) filters.priority = priority;

    try {
        const { offset, limit: pageLimit } = getPagination(Number(page), Number(limit));
        const subtasks = await Subtask.find(filters)
            .skip(offset)
            .limit(pageLimit);

        const totalSubtasks = await Subtask.countDocuments(filters);
        res.status(200).json({ subtasks, totalSubtasks, page: Number(page), totalPages: Math.ceil(totalSubtasks / pageLimit) });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching my subtasks', error });
    }
};

// Get Subtasks Assigned to User
export const getAssignedSubtasksForTask = async (req: Request, res: Response) => {
    const { taskId } = req.params; // Get the task ID from the URL params
    const { status, priority, page = '1', limit = '10' } = req.query as {
        status?: string;
        priority?: string;
        page?: number;
        limit?: number;
    };

    const userId = req.user?.id; // Get the user ID from the request
    const isValidObjectId = mongoose.Types.ObjectId.isValid(taskId); // Validate task ID

    if (!isValidObjectId) {
        res.status(404).json({ message: 'Invalid Task ID' });
        return;
    }

    const filters: any = {
        assignedTo: userId, // Filter subtasks assigned to the user
        taskId: taskId // Ensure subtasks belong to the specified task
    };

    // Validate and set `status`
    if (status && validStatuses.includes(status)) filters.status = status;

    // Validate and set `priority`
    if (priority && validPriorities.includes(priority)) filters.priority = priority;

    try {
        const { offset, limit: pageLimit } = getPagination(Number(page), Number(limit));
        const subtasks = await Subtask.find(filters)
            .skip(offset)
            .limit(pageLimit);

        const totalSubtasks = await Subtask.countDocuments(filters);
        res.status(200).json({ subtasks, totalSubtasks, page: Number(page), totalPages: Math.ceil(totalSubtasks / pageLimit) });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching assigned subtasks', error });
    }
};