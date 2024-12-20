import { Request, Response } from 'express';
import Task, { ITask } from '../models/taskModel';
import Subtask from '../models/subtaskModel';
import { createNotification } from '../utils/notifications';
import { arraysEqual } from '../utils/arrayUtils';
import mongoose, { Types } from 'mongoose';

const validStatus = ['to do', 'pending', 'completed'];
const validPriorities = ['low', 'medium', 'high'];
// Admin: Create a Task
export const createTask = async (req: Request, res: Response) => {
    const requestingUserId = new Types.ObjectId(req.user?.id);
    const username = req.user?.username;

    const session = await mongoose.startSession();
    try {
        session.startTransaction();
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

        const task = new Task({
            title,
            description,
            priority,
            creator: req.user?.id,
            assignedTo: assignedUsers.length > 0 ? assignedUsers : undefined,
        });

        await task.save({ session });

        // Create notifications for all assigned users if there are any
        if (assignedUsers.length > 0) {

            for (const userId of assignedUsers) {
                const result = await createNotification({
                    session,
                    originatorId: requestingUserId,
                    recipientId: userId,
                    message: `${username?.toLocaleUpperCase()} assigned you to task ${task.title}.`,
                    taskId: task._id as Types.ObjectId,
                });

                if (!result.success) {
                    res.status(500).json({ message: result.error || 'An error occurred while creating notification' });
                    return;
                }
            };

        }

        await session.commitTransaction();
        session.endSession();
        res.status(201).json({ task, message: 'Task added succesfully!' });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
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
    const requestingUserId = new Types.ObjectId(req.user?.id);
    const username = req.user?.username;

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

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        // Fetch the existing task
        const existingTask = await Task.findById(taskId);
        if (!existingTask) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }

        const allAssignedUsers = (assignedTo as string[] || []).map(user => new Types.ObjectId(user));
        const previousAssignedUsers = existingTask.assignedTo || [];

        const addedUsers = allAssignedUsers.filter(user =>
            !previousAssignedUsers.some(existingUser => existingUser.equals(user))
        );
        const removedUsers = previousAssignedUsers.filter(user =>
            !allAssignedUsers.some(newUser => newUser.equals(user))
        );

        // check actual content update
        const isContentUpdated = (updates: any): boolean => {
            const { title, description, priority } = updates;
            return Boolean(title || description || priority);
        };
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
        const updatedTask = await Task.findByIdAndUpdate(taskId, updates, { session, new: true, runValidators: true });

        // Check if the updatedTask is null
        if (!updatedTask) {
            res.status(404).json({ message: 'Task not found after update' });
            return;
        }

        // Update Subtasks: filter removed users from assignedTo
        const updatedSubtask = await Subtask.updateMany(
            { taskId },
            { $pull: { assignedTo: { $in: removedUsers } } },
            { session, new: true, runValidators: true }
        );

        if (!updatedSubtask) {
            res.status(404).json({ message: 'Subtask not found filtering removed users' });
            return;
        }
        // Check for assigned users
        if (assignedTo !== undefined) {
            // Create notifications for newly assigned users
            for (const userId of addedUsers) {
                const result = await createNotification({
                    session,
                    originatorId: requestingUserId,
                    recipientId: userId,
                    message: `${username?.toLocaleUpperCase()} assigned you to the task ${updatedTask.title}.`,
                    taskId: updatedTask._id as Types.ObjectId,
                });

                if (!result.success) {
                    res.status(500).json({ message: result.error || 'An error occurred while creating notification' });
                    return;
                }
            };

            for (const userId of removedUsers) {
                const result = await createNotification({
                    session,
                    originatorId: requestingUserId,
                    recipientId: userId,
                    message: `${username?.toLocaleUpperCase()} removed you form the task ${updatedTask.title}.`,
                    taskId: updatedTask._id as Types.ObjectId,
                });

                if (!result.success) {
                    res.status(500).json({ message: result.error || 'An error occurred while creating notification' });
                    return;
                }
            };
        }

        // Check for content updates (excluding assignedTo)
        const hasContentUpdate = isContentUpdated(updates);

        if (hasContentUpdate) {
            // Create notifications for assigned users 
            for (const userId of allAssignedUsers) {
                if (!userId.equals(requestingUserId) && !userId.equals(updatedTask.creator)) {
                    const result = await createNotification({
                        session,
                        originatorId: requestingUserId,
                        recipientId: userId,
                        message: `${username?.toLocaleUpperCase()} updated the task ${updatedTask.title}.`,
                        taskId: updatedTask._id as Types.ObjectId,
                    });

                    if (!result.success) {
                        res.status(500).json({ message: result.error || 'An error occurred while creating notification' });
                        return;
                    }
                }
            };
        }

        await session.commitTransaction();
        session.endSession();
        res.status(200).json({ updatedTask, message: 'Task updated succesfully!' });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: 'Error updating task!', error });
    }
};

// Assignee: Update Task Status
export const updateTaskStatus = async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const requestingUserId = new Types.ObjectId(req.user?.id);
    const username = req.user?.username;

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

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

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
        await task.save({ session, validateBeforeSave: true });

        // Notify the creator if they are not the one making the change
        if (!requestingUserId.equals(task.creator)) {
            const result = await createNotification({
                session,
                originatorId: requestingUserId,
                recipientId: task.creator,
                message: `${username?.toLocaleUpperCase()} updated the status of task ${task.title} to ${status}.`,
                taskId: task._id as Types.ObjectId,
            });

            if (!result.success) {
                res.status(500).json({ message: result.error || 'An error occurred while creating notification' });
                return;
            }
        }

        // Notify assigned users, excluding the one making the change
        const assignedTo = task.assignedTo;
        for (const userId of assignedTo) {
            if (!userId.equals(requestingUserId) && !userId.equals(task.creator)) {
                const result = await createNotification({
                    session,
                    originatorId: requestingUserId,
                    recipientId: userId,
                    message: `${username?.toLocaleUpperCase()} updated the status of task ${task.title} to ${status}.`,
                    taskId: task._id as Types.ObjectId,
                });

                if (!result.success) {
                    res.status(500).json({ message: result.error || 'An error occurred while creating notification' });
                    return;
                }
            }
        };

        await session.commitTransaction();
        session.endSession()
        res.json({ task, message: 'Task status updated!' });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: 'Error updating task status!', error });
    }
};

// Delete Task and its associated Subtasks
export const deleteTask = async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const requestingUserId = new Types.ObjectId(req.user?.id);
    const username = req.user?.username;

    const isValidObjectId = Types.ObjectId.isValid(taskId);

    if (!isValidObjectId) {
        res.status(404).json({ message: 'Invalid Request' });
        return;
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        // Find the task
        const task = await Task.findById(taskId);

        if (!task) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }

        const assignedTo = task.assignedTo;

        // Check for assigned users
        if (assignedTo && assignedTo.length > 0) {
            for (const userId of assignedTo) {
                const result = await createNotification({
                    session,
                    originatorId: requestingUserId,
                    recipientId: userId,
                    message: `${username?.toLocaleUpperCase()} deleted the task ${task.title}.`,
                    taskId: task._id as Types.ObjectId,
                });

                if (!result.success) {
                    res.status(500).json({ message: result.error || 'An error occurred while creating notification' });
                    return;
                }
            };
        }

        // Delete all associated subtasks
        await Subtask.deleteMany({ taskId: taskId }, { session });

        // Delete the task
        await task.deleteOne({ session });

        await session.commitTransaction();
        session.endSession()
        res.status(200).json({ deletedTaskId: taskId, message: 'Task deleted successfully!' });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
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
    const requestingUserId = new Types.ObjectId(req.user?.id);

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
                { creator: requestingUserId },
                { assignedTo: requestingUserId }
            ],
            ...filters
        })
            .sort({ createdAt: -1 })
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
    const requestingUserId = new Types.ObjectId(req.user?.id);

    const filters: any = { creator: requestingUserId };

    // Validate and set `status`
    if (status && validStatus.includes(status))
        filters.status = status;

    // Validate and set `priority`
    if (priority && validPriorities.includes(priority))
        filters.priority = priority;

    try {
        const { offset, limit: pageLimit } = getPagination(Number(page), Number(limit));
        const tasks = await Task.find(filters)
            .sort({ createdAt: -1 })
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
    const requestingUserId = new Types.ObjectId(req.user?.id);

    const filters: any = { assignedTo: requestingUserId };

    // Validate and set `status`
    if (status && validStatus.includes(status))
        filters.status = status;

    // Validate and set `priority`
    if (priority && validPriorities.includes(priority))
        filters.priority = priority;

    try {
        const { offset, limit: pageLimit } = getPagination(Number(page), Number(limit));
        const tasks = await Task.find(filters)
            .sort({ createdAt: -1 })
            .skip(offset)
            .limit(pageLimit);

        const totalTasks = await Task.countDocuments(filters);
        res.status(200).json({ tasks, totalTasks, page: Number(page), totalPages: Math.ceil(totalTasks / pageLimit) });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching assigned tasks', error });
    }
};


// Add Comment to Task
export const addCommentToTask = async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const requestingUserId = new Types.ObjectId(req.user?.id);
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


    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        const task = await Task.findById(taskId);
        if (!task) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }

        const comment = task.comments.create({
            userId: requestingUserId,
            text,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        task.comments.push(comment);
        await task.save({ session });

        // Notify the creator if they are not the one adding the comment
        if (!requestingUserId.equals(task.creator)) {
            const result = await createNotification({
                session,
                originatorId: requestingUserId,
                recipientId: task.creator,
                message: `${username?.toLocaleUpperCase()} commented ${text} on your task ${task.title}.`,
                taskId: task._id as Types.ObjectId,
            });

            if (!result.success) {
                res.status(500).json({ message: result.error || 'An error occurred while creating notification' });
                return;
            }
        }

        // Notify assigned users, excluding the one adding the comment
        const assignedTo = task.assignedTo;

        for (const userId of assignedTo) {
            if (!userId.equals(requestingUserId)) {
                const result = await createNotification({
                    session,
                    originatorId: requestingUserId,
                    recipientId: userId,
                    message: `${username?.toLocaleUpperCase()} commented ${text} on your task ${task.title}.`,
                    taskId: task._id as Types.ObjectId,
                });

                if (!result.success) {
                    res.status(500).json({ message: result.error || 'An error occurred while creating notification' });
                    return;
                }
            }
        };

        const populatedTask = await Task.findById(taskId).populate({
            path: 'comments.userId',
            select: 'username email',
        }).session(session);

        if (!populatedTask) {
            res.status(500).json({ message: 'Failed to fetch comment after comment add!' });
            return;
        }

        const populatedComment = populatedTask.comments.id(comment._id);

        await session.commitTransaction();
        session.endSession();
        res.json({ comment: populatedComment, message: 'Comment added!' });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: 'Error adding comment', error });
    }
};

// edit task commnet
export const editTaskComment = async (req: Request, res: Response) => {
    const { taskId, commentId } = req.params;
    const requestingUserId = new Types.ObjectId(req.user?.id);
    const { text } = req.body;

    if (!text || !Types.ObjectId.isValid(taskId) || !Types.ObjectId.isValid(commentId)) {
        res.status(400).json({ message: 'Invalid Request' });
        return;
    }

    try {
        const task = await Task.findById(taskId).populate({
            path: 'comments.userId',
            select: 'username email',
        });

        if (!task) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }

        const comment = task.comments.id(commentId);
        if (!comment) {
            res.status(404).json({ message: 'Comment not found' });
            return;
        }

        if (!requestingUserId.equals(comment.userId._id)) {
            res.status(403).json({ message: 'You are not authorized to edit this comment' });
            return;
        }

        comment.text = text;
        comment.updatedAt = new Date();
        await task.save();

        res.json({ editedComment: task.comments.id(commentId), message: 'Comment edited successfully!' });
    } catch (error) {
        res.status(500).json({ message: 'Error editing comment!', error });
    }
};

// Delete task Comment
export const deleteTaskComment = async (req: Request, res: Response) => {
    const { taskId, commentId } = req.params;
    const requestingUserId = new Types.ObjectId(req.user?.id);

    if (!Types.ObjectId.isValid(taskId) || !Types.ObjectId.isValid(commentId)) {
        res.status(400).json({ message: 'Invalid Request' });
        return;
    }

    try {
        const task = await Task.findById(taskId);

        if (!task) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }

        const commentIndex = task.comments.findIndex(
            (comment) => comment._id.toString() === commentId
        );

        if (commentIndex === -1) {
            res.status(404).json({ message: 'Comment not found' });
            return;
        }

        if (!requestingUserId.equals(task.comments[commentIndex].userId) && !requestingUserId.equals(task.creator)) {
            res.status(403).json({ message: 'You are not authorized to delete this comment' });
            return;
        }

        task.comments.splice(commentIndex, 1);
        await task.save();

        res.json({ deletedCommentId: commentId, message: 'Comment deleted successfully!' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting comment', error });
    }
};

// get all task comments
export const getAllCommentsForTask = async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const isValidObjectId = Types.ObjectId.isValid(taskId);
    if (!isValidObjectId) {
        res.status(404).json({ message: 'Invalid Request' });
        return;
    }

    try {
        const { offset, limit: pageLimit } = getPagination(Number(page), Number(limit));

        const task = await Task.findById(taskId).populate({
            path: 'comments.userId',
            select: 'username email',
        });
        if (!task) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }

        const totalComments = task.comments.length;
        const paginatedComments = task.comments
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(offset, Number(page) * pageLimit);

        res.json({
            comments: paginatedComments,
            totalComments,
            page: Number(page),
            totalPages: Math.ceil(totalComments / pageLimit),
            message: 'Comments fetched successfully!'
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching comments for task', error });
    }
};
