import { Request, Response } from 'express';
import Subtask from '../models/subtaskModel';
import Task from '../models/taskModel';
import { createNotification } from '../utils/notifications'
import { Types } from 'mongoose';

const validStatuses = ['pending', 'completed'];
const validPriorities = ['low', 'medium', 'high'];

export const createSubtask = async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const creatorId = req.user?.id;

    try {
        const { title, description, priority, assignedTo } = req.body;
        const isValidObjectId = Types.ObjectId.isValid(taskId);
        if (!isValidObjectId) {
            res.status(404).json({ message: 'Invalid Task' });
            return
        }
        const task = await Task.findById(taskId);
        if (!task) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }

        // Initialize assignedTo to an empty array if not provided
        const assignedUsers = Array.isArray(assignedTo) ? assignedTo : [];

        const subtask = await Subtask.create({
            title,
            description,
            priority,
            creator: req.user?.id,
            assignedTo: assignedUsers.length > 0 ? assignedUsers : undefined,
            taskId, // Reference to the parent task
        });

        // Notify the task admin (if they are not the creator)
        if (task.creator.toString() !== creatorId) {
            createNotification({
                userId: task.creator,
                message: `A new subtask ${subtask.title} has been created for your task: ${task.title}.`,
                taskId: task._id as Types.ObjectId,
                subtaskId: subtask._id as Types.ObjectId,
            });
        }

        if (assignedUsers.length > 0) {
            // Notify assigned users (excluding the creator)
            assignedUsers
                .filter(userId => userId.toString() !== creatorId)
                .forEach(userId => {
                    createNotification({
                        userId,
                        message: `You have been assigned to the subtask: ${subtask.title} of task: ${task.title}.`,
                        subtaskId: subtask._id as Types.ObjectId,
                    });
                });
        }

        res.status(201).json(subtask);
    } catch (error) {
        res.status(500).json({ message: 'Error creating subtask', error });
    }
};
// Get Subtasks by Task ID
export const getSubtasksBySubtaskId = async (req: Request, res: Response) => {
    const { subtaskId } = req.params;

    const isValidObjectId = Types.ObjectId.isValid(subtaskId);
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

export const updateSubtask = async (req: Request, res: Response) => {
    const { subtaskId } = req.params;
    const updaterId = req.user?.id

    const isValidObjectId = Types.ObjectId.isValid(subtaskId);
    if (!isValidObjectId) {
        res.status(404).json({ message: 'Invalid Request' });
        return;
    }

    const { title, description, priority, assignedTo } = req.body;

    try {
        // Fetch the existing subtask
        const existingSubtask = await Subtask.findById(subtaskId).populate('taskId');
        if (!existingSubtask) {
            res.status(404).json({ message: 'Subtask not found' });
            return;
        }

        const task = existingSubtask.taskId as any;
        // Prepare updates
        const updates: any = { title, description, priority };

        // Only update assignedTo if it is provided
        if (assignedTo !== undefined) {
            updates.assignedTo = assignedTo;
        }

        // Update the task
        const updatedSubtask = await Subtask.findByIdAndUpdate(subtaskId, updates, { new: true, runValidators: true });

        // Check if the updatedSubtask is null
        if (!updatedSubtask) {
            res.status(404).json({ message: 'Subtask not found after update' });
            return;
        }

        // Handle notifications for assigned users
        if (assignedTo !== undefined) {
            const previousAssignedUsers = existingSubtask.assignedTo || [];
            const newAssignedUsers = assignedTo || [];

            // Determine newly assigned and removed users
            const addedUsers = newAssignedUsers.filter((user: Types.ObjectId) => !previousAssignedUsers.includes(user));
            const removedUsers = previousAssignedUsers.filter(user => !newAssignedUsers.includes(user));

            // Notify newly assigned users, excluding the updater
            addedUsers
                .filter((userId: Types.ObjectId) => userId.toString() !== updaterId)
                .forEach((userId: Types.ObjectId) => {
                    createNotification({
                        userId,
                        message: `You have been assigned to the subtask: ${updatedSubtask.title} of task: ${task.title}.`,
                        taskId: task._id as Types.ObjectId,
                        subtaskId: updatedSubtask._id as Types.ObjectId,
                    });
                });

            // Notify users who were removed from the subtask
            removedUsers.forEach(userId => {
                createNotification({
                    userId,
                    message: `You have been removed from the subtask: ${updatedSubtask.title} of task: ${task.title}.`,
                    taskId: task._id as Types.ObjectId,
                    subtaskId: updatedSubtask._id as Types.ObjectId,
                });
            });
        }

        // Notify task admin if they are not the updater
        if (task.creator.toString() !== updaterId) {
            createNotification({
                userId: task.creator,
                message: `The subtask ${updatedSubtask.title} in your task ${task.title} has been updated.`,
                taskId: task._id as Types.ObjectId,
                subtaskId: updatedSubtask._id as Types.ObjectId,
            });
        }
        // Notify the subtask creator (subtask admin) if they didn't update the status
        if (updatedSubtask.creator.toString() !== updaterId) {
            createNotification({
                userId: updatedSubtask.creator,
                message: `The subtask ${updatedSubtask.title} in your task ${task.title} has been updated.`,
                taskId: task._id as Types.ObjectId,
                subtaskId: updatedSubtask._id as Types.ObjectId,
            });
        }
        res.status(200).json(updatedSubtask);
    } catch (error) {
        res.status(500).json({ message: 'Error updating subtask', error });
    }
};

export const updateSubtaskStatus = async (req: Request, res: Response) => {
    const { subtaskId } = req.params;
    const updaterId = req.user?.id;

    const isValidObjectId = Types.ObjectId.isValid(subtaskId);
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

        // Get the parent task
        const task = await Task.findById(subtask.taskId);
        if (!task) {
            res.status(404).json({ message: 'Parent task not found' });
            return;
        }

        // Notify the task admin (task creator) if they didn't update the status
        if (task.creator.toString() !== updaterId) {
            createNotification({
                userId: task.creator,
                message: `The status of subtask ${subtask.title} has been updated to ${status}.`,
                taskId: task._id as Types.ObjectId,
                subtaskId: subtask._id as Types.ObjectId,
            });
        }

        // Notify the subtask creator (subtask admin) if they didn't update the status
        if (subtask.creator.toString() !== updaterId) {
            createNotification({
                userId: subtask.creator,
                message: `The status of your subtask ${subtask.title} has been updated to ${status}.`,
                taskId: task._id as Types.ObjectId,
                subtaskId: subtask._id as Types.ObjectId,
            });
        }

        // Notify all assigned users except the updater
        const assignedTo = subtask.assignedTo || [];
        assignedTo
            .filter((userId: Types.ObjectId) => userId.toString() !== updaterId)
            .forEach((userId: Types.ObjectId) => {
                createNotification({
                    userId,
                    message: `The status of subtask ${subtask.title} has been updated to ${status}.`,
                    taskId: task._id as Types.ObjectId,
                    subtaskId: subtask._id as Types.ObjectId,
                });
            });

        res.json(subtask);
    } catch (error) {
        res.status(500).json({ message: 'Error updating subtask status', error });
    }
};

export const addCommentToSubtask = async (req: Request, res: Response) => {
    const { subtaskId } = req.params;
    const userId = req.user?.id; // ID of the user adding the comment

    const isValidObjectId = Types.ObjectId.isValid(subtaskId);
    if (!isValidObjectId) {
        res.status(404).json({ message: 'Invalid Request' });
        return;
    }
    const { text } = req.body;

    try {
        const subtask = await Subtask.findById(subtaskId);
        if (!subtask) {
            res.status(404).json({ message: 'Subtask not found' });
            return;
        }
        const comment = { userId: new Types.ObjectId(userId), text, createdAt: new Date() };
        subtask.comments.push(comment);
        await subtask.save();

        // Get the parent task
        const task = await Task.findById(subtask.taskId);
        if (task) {
            // Notify the task creator (admin)
            if (task.creator.toString() !== userId) {
                createNotification({
                    userId: task.creator,
                    message: `A new comment has been added to the subtask ${subtask.title} of your task ${task.title}: ${text}`,
                    taskId: task._id as Types.ObjectId,
                    subtaskId: subtask._id as Types.ObjectId,
                });
            }

            // Notify the subtask creator (admin)
            if (subtask.creator.toString() !== userId) {
                createNotification({
                    userId: subtask.creator,
                    message: `A new comment has been added to your subtask ${subtask.title}: ${text}`,
                    taskId: task._id as Types.ObjectId,
                    subtaskId: subtask._id as Types.ObjectId,
                });
            }

            // Notify the subtask assignees
            const assignedTo = subtask.assignedTo || [];
            assignedTo
                .filter((assignedUserId: Types.ObjectId) => assignedUserId.toString() !== userId)
                .forEach((assignedUserId: Types.ObjectId) => {
                    createNotification({
                        userId: assignedUserId,
                        message: `A new comment has been added to the subtask ${subtask.title}: ${text}`,
                        taskId: task._id as Types.ObjectId,
                        subtaskId: subtask._id as Types.ObjectId,
                    });
                });
        }

        res.json(subtask);
    } catch (error) {
        res.status(500).json({ message: 'Error adding comment to subtask', error });
    }
};

// Delete Subtask
export const deleteSubtask = async (req: Request, res: Response) => {
    const { subtaskId } = req.params;
    const userId = req.user?.id; // ID of the user deleting the subtask

    const isValidObjectId = Types.ObjectId.isValid(subtaskId);

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

        // Get the parent task
        const task = await Task.findById(subtask.taskId);
        if (task) {
            // Notify the task creator (admin)
            if (task.creator.toString() !== userId) {
                createNotification({
                    userId: task.creator,
                    message: `The subtask ${subtask.title} has been deleted from your task ${task.title}.`,
                    taskId: task._id as Types.ObjectId,
                    subtaskId: subtask._id as Types.ObjectId,
                });
            }

            // Notify the subtask creator (admin)
            if (subtask.creator.toString() !== userId) {
                createNotification({
                    userId: subtask.creator,
                    message: `Your subtask ${subtask.title} has been deleted.`,
                    taskId: task._id as Types.ObjectId,
                    subtaskId: subtask._id as Types.ObjectId,
                });
            }

            // Notify the subtask assignees
            const assignedTo = subtask.assignedTo || [];
            assignedTo
                .filter((assignedUserId: Types.ObjectId) => assignedUserId.toString() !== userId)
                .forEach((assignedUserId: Types.ObjectId) => {
                    createNotification({
                        userId: assignedUserId,
                        message: `The subtask ${subtask.title} has been deleted.`,
                        taskId: task._id as Types.ObjectId,
                        subtaskId: subtask._id as Types.ObjectId,
                    });
                });
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
    const isValidObjectId = Types.ObjectId.isValid(taskId);
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
    const isValidObjectId = Types.ObjectId.isValid(taskId); // Validate task ID

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
    const isValidObjectId = Types.ObjectId.isValid(taskId); // Validate task ID

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