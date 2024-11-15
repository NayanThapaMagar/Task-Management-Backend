import { Request, Response } from 'express';
import Task from '../models/taskModel';
import Subtask from '../models/subtaskModel';
import { createNotification } from '../utils/notifications';
import { arraysEqual } from '../utils/arrayUtils';
import { Types } from 'mongoose';

const validStatus = ['to do', 'pending', 'completed'];
const validPriorities = ['low', 'medium', 'high'];
// Admin: Create a Task
export const createTask = async (req: Request, res: Response) => {
    try {
        const { title, description, priority, assignedTo } = req.body;

        if (!title) {
            res.status(400).json({ message: 'Title is required' });
            return
        }
        const strippedDescription = description.replace(/<[^>]+>/g, '').trim();
        if (!strippedDescription) {
            res.status(400).json({ message: 'Description is required' });
            return
        }
        // Initialize assignedTo to an empty array if not provided
        const assignedUsers = Array.isArray(assignedTo) ? assignedTo : [];

        // Create the task
        const task = await Task.create({
            title,
            description,
            priority,
            creator: req.user?.id,
            assignedTo: assignedUsers.length > 0 ? assignedUsers : undefined, // Set to undefined if empty
        });

        // Create notifications for all assigned users if there are any
        if (assignedUsers.length > 0) {
            assignedUsers.forEach(userId => {
                createNotification({
                    userId,
                    message: `You have been assigned to the task: ${task.title}`,
                    taskId: task._id as Types.ObjectId,
                });
            });
        }

        res.status(201).json({ task, message: 'Task added succesfully!' });
    } catch (error) {
        res.status(500).json({ message: 'Error creating task', error });
    }
};

// Get Task by ID
export const getTaskById = async (req: Request, res: Response) => {
    const { taskId } = req.params;

    const isValidObjectId = Types.ObjectId.isValid(taskId); // Validate task ID
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
        res.status(200).json({ task }); // Return the task
    } catch (error) {
        res.status(500).json({ message: 'Error fetching task', error });
    }
};

// Admin: Update Task Details
export const updateTask = async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const isValidObjectId = Types.ObjectId.isValid(taskId);
    if (!isValidObjectId) {
        res.status(404).json({ message: 'Invalid Request' });
        return;
    }

    const { title, description, priority, assignedTo } = req.body;

    if (!title) {
        res.status(400).json({ message: 'Title is required' });
        return
    }
    const strippedDescription = description.replace(/<[^>]+>/g, '').trim();
    if (!strippedDescription) {
        res.status(400).json({ message: 'Description is required' });
        return
    }

    try {
        // Fetch the existing task
        const existingTask = await Task.findById(taskId);
        if (!existingTask) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }

        // Compare new values with existing values
        const updates: any = {};
        if (title && title !== existingTask.title) updates.title = title;
        if (description && description !== existingTask.description) updates.description = description;
        if (priority && priority !== existingTask.priority) updates.priority = priority;

        // Only update assignedTo if it is provided and different
        if (assignedTo !== undefined && !arraysEqual(assignedTo, existingTask.assignedTo)) {
            updates.assignedTo = assignedTo;
        }

        // If no new updates, skip the update process
        if (Object.keys(updates).length === 0) {
            res.status(200).json({ updatedTask: existingTask, message: 'No Changes Detected' });
            return;
        }

        // Update the task
        const updatedTask = await Task.findByIdAndUpdate(taskId, updates, { new: true, runValidators: true });

        // Check if the updatedTask is null
        if (!updatedTask) {
            res.status(404).json({ message: 'Task not found after update' });
            return;
        }

        // Check for assigned users
        if (assignedTo !== undefined) {
            const previousAssignedUsers = existingTask.assignedTo || [];
            const newAssignedUsers = assignedTo || [];

            // Determine newly assigned users
            const addedUsers = newAssignedUsers.filter((user: Types.ObjectId) => !previousAssignedUsers.includes(user));
            const removedUsers = previousAssignedUsers.filter(user => !newAssignedUsers.includes(user));

            // Create notifications for newly assigned users
            addedUsers.forEach((userId: Types.ObjectId) => {
                createNotification({
                    userId,
                    message: `You have been assigned to the task: ${updatedTask.title}`,
                    taskId: updatedTask._id as Types.ObjectId,
                });
            });

            removedUsers.forEach(userId => {
                createNotification({
                    userId,
                    message: `You have been removed form the task: ${updatedTask.title}`,
                    taskId: updatedTask._id as Types.ObjectId,
                });
            });
        }

        res.status(200).json({ updatedTask, message: 'Task updated succesfully!' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating task', error });
    }
};

// Assignee: Update Task Status
export const updateTaskStatus = async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const userId = req.user?.id;

    const isValidObjectId = Types.ObjectId.isValid(taskId);
    if (!isValidObjectId) {
        res.status(404).json({ message: 'Invalid Request' });
        return;
    }
    const { status } = req.body;

    if (!status || !validStatus.includes(status)) {
        res.status(400).json({ message: 'Invalid Status' });
        return;
    }

    try {
        const task = await Task.findById(taskId);
        if (!task) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }

        // Check if the new status is the same as the current status
        if (task.status === status) {
            res.status(400).json({ message: 'No changes detected, status not updated' });
            return;
        }

        // Update the task status
        task.status = status;
        await task.save({ validateBeforeSave: true });

        // Notify the creator if they are not the one making the change
        if (task.creator.toString() !== userId) {
            createNotification({
                userId: task.creator,
                message: `The status of task ${task.title} has been updated to ${status}.`,
                taskId: task._id as Types.ObjectId,
            });
        }

        // Notify assigned users, excluding the one making the change
        const assignedTo = task.assignedTo || [];
        assignedTo.forEach((assignedUserId: Types.ObjectId) => {
            if (assignedUserId.toString() !== userId) {
                createNotification({
                    userId: assignedUserId,
                    message: `The status of task ${task.title} has been updated to ${status}.`,
                    taskId: task._id as Types.ObjectId,
                });
            }
        });
        res.json({ task, message: 'Task status updated!' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating task status!', error });
    }
};

// Assignee: Add Comment to Task
export const addComment = async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const userId = req.user?.id;
    const username = req.user?.username;

    const isValidObjectId = Types.ObjectId.isValid(taskId);
    if (!isValidObjectId) {
        res.status(404).json({ message: 'Invalid Request' });
        return;
    }
    const { text } = req.body;

    if (!text) {
        res.status(400).json({ message: 'Invalid Comment' });
        return;
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

        // Notify the creator if they are not the one adding the comment
        if (task.creator.toString() !== userId) {
            createNotification({
                userId: task.creator,
                message: `${username} commented to your task ${task.title}: ${text}`,
                taskId: task._id as Types.ObjectId,
            });
        }

        // Notify assigned users, excluding the one adding the comment
        const assignedTo = task.assignedTo || [];
        assignedTo.forEach((assignedUserId: Types.ObjectId) => {
            if (assignedUserId.toString() !== userId) {
                createNotification({
                    userId: assignedUserId,
                    message: `${username} commented to your task ${task.title}: ${text}`,
                    taskId: task._id as Types.ObjectId,
                });
            }
        });

        res.json({ task, comment, message: 'Comment added!' });
    } catch (error) {
        res.status(500).json({ message: 'Error adding comment', error });
    }
};

// Delete Task and its associated Subtasks
export const deleteTask = async (req: Request, res: Response) => {
    const { taskId } = req.params;

    const isValidObjectId = Types.ObjectId.isValid(taskId);

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

        const assignedTo = task.assignedTo;

        // Check for assigned users
        if (assignedTo && assignedTo.length > 0) {
            assignedTo.forEach((assignedUserId: Types.ObjectId) => {
                createNotification({
                    userId: assignedUserId,
                    message: `Your task ${task.title} has been deleted.`,
                    taskId: task._id as Types.ObjectId,
                });
            });
        }

        // Delete all associated subtasks
        await Subtask.deleteMany({ taskId: taskId });

        // Delete the task
        await task.deleteOne();

        res.status(200).json({ deletedTaskId: taskId, message: 'Task deleted successfully!' });
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
    if (status && validStatus.includes(status))
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
    if (status && validStatus.includes(status))
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
    if (status && validStatus.includes(status))
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