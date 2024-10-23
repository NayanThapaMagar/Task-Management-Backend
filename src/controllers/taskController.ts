import { Request, Response } from 'express';
import Task from '../models/taskModel';
import Subtask from '../models/subTaskModel';
import { Types } from 'mongoose';
const mongoose = require('mongoose');


const validStatuses = ['pending', 'completed'];
const validPriorities = ['low', 'medium', 'high'];
// Admin: Create a Task
export const createTask = async (req: Request, res: Response) => {
    try {
        const { title, description, priority, assignedTo } = req.body;
        const task = await Task.create({
            title,
            description,
            priority,
            creator: req.user?.id,
            assignedTo,
        });
        res.status(201).json(task);
    } catch (error) {
        res.status(500).json({ message: 'Error creating task', error });
    }
};

// Get Task by ID
export const getTaskById = async (req: Request, res: Response) => {
    const { taskId } = req.params; // Get task ID from request parameters

    const isValidObjectId = mongoose.Types.ObjectId.isValid(taskId); // Validate task ID
    if (!isValidObjectId) {
        res.status(404).json({ message: 'Invalid Task ID' });
        return
    }

    try {
        const task = await Task.findById(taskId); // Find task by ID
        if (!task) {
            res.status(404).json({ message: 'Task not found' });
            return
        }
        res.status(200).json(task); // Return the task
    } catch (error) {
        res.status(500).json({ message: 'Error fetching task', error });
    }
};

// Admin: Update Task Details
export const updateTask = async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const isValidObjectId = mongoose.Types.ObjectId.isValid(taskId);
    if (!isValidObjectId) {
        res.status(404).json({ message: 'Invalid Request' });
        return;
    }
    const { title, description, priority, assignedTo } = req.body;
    const updates = { title, description, priority, assignedTo };
    try {
        const task = await Task.findByIdAndUpdate(taskId, updates, { new: true, runValidators: true });
        if (!task) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }
        res.status(200).json(task);
    } catch (error) {
        res.status(500).json({ message: 'Error updating task', error });
    }
};

// Assignee: Update Task Status
export const updateTaskStatus = async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const isValidObjectId = mongoose.Types.ObjectId.isValid(taskId);
    if (!isValidObjectId) {
        res.status(404).json({ message: 'Invalid Request' });
        return;
    }
    const { status } = req.body;
    try {
        const task = await Task.findByIdAndUpdate(
            taskId,
            { status },
            { new: true, runValidators: true }
        );
        if (!task) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }
        res.json(task);
    } catch (error) {
        res.status(500).json({ message: 'Error updating task status', error });
    }
};

// Assignee: Add Comment to Task
export const addComment = async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const isValidObjectId = mongoose.Types.ObjectId.isValid(taskId);
    if (!isValidObjectId) {
        res.status(404).json({ message: 'Invalid Request' });
        return;
    }
    const { text } = req.body;
    const userId = req.user?.id;

    if (!userId) {
        res.status(400).json({ message: 'User is not authorized to add a comment' });
        return
    }

    try {
        const task = await Task.findById(taskId);
        if (!task) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }
        const comment = { userId: new Types.ObjectId(userId), text, createdAt: new Date() };
        task.comments.push(comment);
        await task.save();
        res.json(task);
    } catch (error) {
        res.status(500).json({ message: 'Error adding comment', error });
    }
};

// Delete Task and its associated Subtasks
export const deleteTask = async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const isValidObjectId = mongoose.Types.ObjectId.isValid(taskId);

    if (!isValidObjectId) {
        res.status(404).json({ message: 'Invalid Request' });
        return;
    }

    try {
        // Find the task
        const task = await Task.findById(taskId);

        if (!task) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }

        // Delete all associated subtasks
        await Subtask.deleteMany({ taskId: taskId });

        // Delete the task
        await task.deleteOne();

        res.status(200).json({ message: 'Task deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting task', error });
    }
};


// Helper function for pagination
const getPagination = (page: number, limit: number) => {
    const offset = (page - 1) * limit;
    return { offset, limit };
};

// Get All Tasks (for Admin)
export const getAllTasks = async (req: Request, res: Response) => {
    const { status, priority, page = '1', limit = '10' } = req.query as {
        status?: string;
        priority?: string;
        page?: number;
        limit?: number;
    };
    const userId = req.user?.id;

    const filters: any = {};

    // Validate and set `status`
    if (status && validStatuses.includes(status))
        filters.status = status;

    // Validate and set `priority`
    if (priority && validPriorities.includes(priority))
        filters.priority = priority;


    try {
        const { offset, limit: pageLimit } = getPagination(Number(page), Number(limit));
        const tasks = await Task.find({
            $or: [
                { creator: userId },
                { assignedTo: userId }
            ],
            ...filters
        })
            .skip(offset)
            .limit(pageLimit);

        const totalTasks = await Task.countDocuments(filters);
        res.status(200).json({ tasks, totalTasks, page: Number(page), totalPages: Math.ceil(totalTasks / pageLimit) });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching tasks', error });
    }
};

// Get Tasks Created by User (My Tasks)
export const getMyTasks = async (req: Request, res: Response) => {
    const { status, priority, page = '1', limit = '10' } = req.query as {
        status?: string;
        priority?: string;
        page?: number;
        limit?: number;
    };
    const userId = req.user?.id;

    const filters: any = { creator: userId };

    // Validate and set `status`
    if (status && validStatuses.includes(status))
        filters.status = status;

    // Validate and set `priority`
    if (priority && validPriorities.includes(priority))
        filters.priority = priority;

    try {
        const { offset, limit: pageLimit } = getPagination(Number(page), Number(limit));
        const tasks = await Task.find(filters)
            .skip(offset)
            .limit(pageLimit);

        const totalTasks = await Task.countDocuments(filters);
        res.status(200).json({ tasks, totalTasks, page: Number(page), totalPages: Math.ceil(totalTasks / pageLimit) });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching my tasks', error });
    }
};

// Get Tasks Assigned to User (Assigned Tasks)
export const getAssignedTasks = async (req: Request, res: Response) => {
    const { status, priority, page = '1', limit = '10' } = req.query as {
        status?: string;
        priority?: string;
        page?: number;
        limit?: number;
    };
    const userId = req.user?.id;

    const filters: any = { assignedTo: userId };

    // Validate and set `status`
    if (status && validStatuses.includes(status))
        filters.status = status;

    // Validate and set `priority`
    if (priority && validPriorities.includes(priority))
        filters.priority = priority;

    try {
        const { offset, limit: pageLimit } = getPagination(Number(page), Number(limit));
        const tasks = await Task.find(filters)
            .skip(offset)
            .limit(pageLimit);

        const totalTasks = await Task.countDocuments(filters);
        res.status(200).json({ tasks, totalTasks, page: Number(page), totalPages: Math.ceil(totalTasks / pageLimit) });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching assigned tasks', error });
    }
};