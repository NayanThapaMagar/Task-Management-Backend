import { Request, Response } from 'express';
import User from '../models/userModel';
import Subtask from '../models/subtaskModel';
import Task, { ITask } from '../models/taskModel';
import { createNotification } from '../utils/notifications'
import { arraysEqual } from '../utils/arrayUtils';
import mongoose, { Types } from 'mongoose';

const validStatus = ['to do', 'pending', 'completed'];
const validPriorities = ['low', 'medium', 'high'];

export const createSubtask = async (req: Request, res: Response) => {
    const { taskId } = req.params;
    const requestingUserId = new Types.ObjectId(req.user?.id);
    const username = req.user?.username;

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

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
        const assignedUsers = (assignedTo as string[] || []).map(user => new Types.ObjectId(user));

        for (const user of assignedUsers) {
            if (!task.assignedTo.includes(user) && !task.creator.equals(user)) {
                const notAssignedAndNonCreatorUser = await User.findById(user)
                if (notAssignedAndNonCreatorUser) {
                    res.status(422).json({ message: `${notAssignedAndNonCreatorUser.username.toUpperCase()} must be first assigned to ${task.title}` });
                } else {
                    res.status(422).json({ message: `User must be first assigned to ${task.title}` });
                }
                return;
            }
        }

        const subtask = new Subtask({
            title,
            description,
            priority,
            creator: req.user?.id,
            assignedTo: assignedUsers.length > 0 ? assignedUsers : undefined,
            taskId,
        });

        await subtask.save({ session });

        // Notify the task admin (if he/she is not the creator)
        if (!requestingUserId.equals(task.creator)) {
            const result = await createNotification({
                session,
                originatorId: requestingUserId,
                recipientId: task.creator,
                message: `${username?.toLocaleUpperCase()} created a new subtask ${subtask.title} in ${task.title}.`,
                subtaskId: subtask._id as Types.ObjectId,
            });

            if (!result.success) {
                res.status(500).json({ message: result.error || 'An error occurred while creating notification' });
                return;
            }
        }

        if (assignedUsers.length > 0) {
            // Notify assigned users (excluding the creator)
            for (const userId of assignedUsers) {
                if (!requestingUserId.equals(userId)) {
                    const result = await createNotification({
                        session,
                        originatorId: requestingUserId,
                        recipientId: userId,
                        message: `${username?.toLocaleUpperCase()} assigned yo to subtask ${subtask.title} of ${task.title}.`,
                        subtaskId: subtask._id as Types.ObjectId,
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
        res.status(201).json({ subtask, message: 'Subtask added succesfully!' });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
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
        res.status(200).json({ subtask }); // Return the subtask
    } catch (error) {
        res.status(500).json({ message: 'Error fetching subtask', error });
    }
};

export const updateSubtask = async (req: Request, res: Response) => {
    const { subtaskId } = req.params;
    const requestingUserId = new Types.ObjectId(req.user?.id);
    const username = req.user?.username;

    const isValidObjectId = Types.ObjectId.isValid(subtaskId);
    if (!isValidObjectId) {
        res.status(404).json({ message: 'Invalid Request' });
        return;
    }

    const { title, description, priority, assignedTo } = req.body;

    const session = await mongoose.startSession();

    try {
        session.startTransaction();
        // Fetch the existing subtask
        const existingSubtask = await Subtask.findById(subtaskId).populate('taskId');
        if (!existingSubtask) {
            res.status(404).json({ message: 'Subtask not found' });
            return;
        }

        const allAssignedUsers = (assignedTo as string[] || []).map(user => new Types.ObjectId(user));
        const previousAssignedUsers = existingSubtask.assignedTo || [];

        const addedUsers = allAssignedUsers.filter(user =>
            !previousAssignedUsers.some(existingUser => existingUser.equals(user))
        );
        const removedUsers = previousAssignedUsers.filter(user =>
            !allAssignedUsers.some(newUser => newUser.equals(user))
        );

        // Prepare updates
        const task = existingSubtask.taskId as unknown as ITask;


        // check actual content update
        const isContentUpdated = (updates: any): boolean => {
            const { title, description, priority } = updates;
            return Boolean(title || description || priority);
        };

        // Compare new values with existing values
        const updates: any = {};
        if (title && title !== existingSubtask.title) updates.title = title;
        if (description && description !== existingSubtask.description) updates.description = description;
        if (priority && priority !== existingSubtask.priority) updates.priority = priority;

        // Only update assignedTo if it is provided and different
        if (assignedTo !== undefined && !arraysEqual(assignedTo, existingSubtask.assignedTo)) {
            updates.assignedTo = assignedTo;
        }

        // If no new updates, skip the update process
        if (Object.keys(updates).length === 0) {
            res.status(200).json({ updatedSubtask: existingSubtask, message: 'No changes detected, subtask not updated' });
            return;
        }

        for (const user of allAssignedUsers) {
            if (!task.assignedTo.includes(user) && !task.creator.equals(user)) {
                const notAssignedAndNonCreatorUser = await User.findById(user)
                if (notAssignedAndNonCreatorUser) {
                    res.status(422).json({ message: `${notAssignedAndNonCreatorUser.username.toUpperCase()} must be first assigned to ${task.title}` });
                } else {
                    res.status(422).json({ message: `User must be first assigned to ${task.title}` });
                }
                return;
            }
        }

        // Update the task
        const updatedSubtask = await Subtask.findByIdAndUpdate(subtaskId, updates, { session, new: true, runValidators: true });

        // Check if the updatedSubtask is null
        if (!updatedSubtask) {
            res.status(404).json({ message: 'Subtask not found after update' });
            return;
        }

        // Handle notifications for assigned users
        if (assignedTo !== undefined) {
            // Notify newly assigned users, excluding the updater
            for (const userId of addedUsers) {
                if (!userId.equals(requestingUserId)) {
                    const result = await createNotification({
                        session,
                        originatorId: requestingUserId,
                        recipientId: userId,
                        message: `${username?.toLocaleUpperCase()} assigned you to subtask ${updatedSubtask.title} of ${task.title}.`,
                        subtaskId: updatedSubtask._id as Types.ObjectId,
                    });

                    if (!result.success) {
                        res.status(500).json({ message: result.error || 'An error occurred while creating notification' });
                        return;
                    }
                }
            };

            // Notify users who were removed from the subtask
            for (const userId of removedUsers) {
                const result = await createNotification({
                    session,
                    originatorId: requestingUserId,
                    recipientId: userId,
                    message: `${username?.toLocaleUpperCase()} removed you from subtask ${updatedSubtask.title} of ${task.title}.`,
                    subtaskId: updatedSubtask._id as Types.ObjectId,
                });

                if (!result.success) {
                    res.status(500).json({ message: result.error || 'An error occurred while creating notification' });
                    return;
                }
            };
        }

        // Check for content updates (excluding assignedTo)
        const hasContentUpdate = isContentUpdated(updates);

        // notify about content update
        if (hasContentUpdate) {
            // Notify task admin if they are not the updater
            if (!requestingUserId.equals(task.creator)) {
                const result = await createNotification({
                    session,
                    originatorId: requestingUserId,
                    recipientId: task.creator,
                    message: `${username?.toLocaleUpperCase()} updated the subtask ${updatedSubtask.title} of ${task.title}.`,
                    subtaskId: updatedSubtask._id as Types.ObjectId,
                });

                if (!result.success) {
                    res.status(500).json({ message: result.error || 'An error occurred while creating notification' });
                    return;
                }
            }
            // Notify the subtask creator (subtask admin) if they didn't update 
            if (!requestingUserId.equals(updatedSubtask.creator)) {
                const result = await createNotification({
                    session,
                    originatorId: requestingUserId,
                    recipientId: updatedSubtask.creator,
                    message: `${username?.toLocaleUpperCase()} updated the subtask ${updatedSubtask.title} of ${task.title}.`,
                    subtaskId: updatedSubtask._id as Types.ObjectId,
                });

                if (!result.success) {
                    res.status(500).json({ message: result.error || 'An error occurred while creating notification' });
                    return;
                }
            }

            // notifing assigned users except the creators of task or subtask
            for (const userId of allAssignedUsers) {
                if (!userId.equals(task.creator) && !userId.equals(updatedSubtask.creator) && !userId.equals(requestingUserId)) {
                    const result = await createNotification({
                        session,
                        originatorId: requestingUserId,
                        recipientId: userId,
                        message: `${username?.toLocaleUpperCase()} updated the subtask ${updatedSubtask.title} of ${task.title}.`,
                        subtaskId: updatedSubtask._id as Types.ObjectId,
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
        res.status(200).json({ updatedSubtask, message: 'Subtask updated succesfully!' });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.log(error);

        res.status(500).json({ message: 'Error updating subtask!', error });
    }
};

export const updateSubtaskStatus = async (req: Request, res: Response) => {
    const { subtaskId } = req.params;
    const requestingUserId = new Types.ObjectId(req.user?.id);
    const username = req.user?.username;

    const isValidObjectId = Types.ObjectId.isValid(subtaskId);
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

        const subtask = await Subtask.findById(subtaskId);
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

        // Check if the new status is the same as the current status
        if (subtask.status === status) {
            res.status(200).json({ message: 'No changes detected, status not updated' });
            return;
        }

        // Update the subtask status
        subtask.status = status;
        await subtask.save({ session, validateBeforeSave: true });

        // Notify the task admin (task creator) if they didn't update the status
        if (!requestingUserId.equals(task.creator)) {
            const result = await createNotification({
                session,
                originatorId: requestingUserId,
                recipientId: task.creator,
                message: `${username?.toLocaleUpperCase()} updated the status of subtask ${subtask.title} of ${task.title} to ${status}.`,
                subtaskId: subtask._id as Types.ObjectId,
            });

            if (!result.success) {
                res.status(500).json({ message: result.error || 'An error occurred while creating notification' });
                return;
            }
        }

        // Notify the subtask creator (subtask admin) if they didn't update the status
        if (!requestingUserId.equals(subtask.creator) && !task.creator.equals(subtask.creator)) {
            const result = await createNotification({
                session,
                originatorId: requestingUserId,
                recipientId: subtask.creator,
                message: `${username?.toLocaleUpperCase()} updated the status of the subtask ${subtask.title} of ${task.title} to ${status}.`,
                subtaskId: subtask._id as Types.ObjectId,
            });

            if (!result.success) {
                res.status(500).json({ message: result.error || 'An error occurred while creating notification' });
                return;
            }
        }

        // Notify all assigned users except the updater(requesting user)
        const assignedTo = subtask.assignedTo;
        for (const userId of assignedTo) {
            if (!userId.equals(requestingUserId) && !userId.equals(task.creator) && !userId.equals(subtask.creator)) {
                const result = await createNotification({
                    session,
                    originatorId: requestingUserId,
                    recipientId: userId,
                    message: `${username?.toLocaleUpperCase()} updated the status of subtask ${subtask.title} of ${task.title} to ${status}.`,
                    subtaskId: subtask._id as Types.ObjectId,
                });

                if (!result.success) {
                    res.status(500).json({ message: result.error || 'An error occurred while creating notification' });
                    return;
                }
            }
        };

        await session.commitTransaction();
        session.endSession()
        res.json({ subtask, message: 'Subtask status updated!' });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: 'Error updating subtask status', error });
    }
};

// Delete Subtask
export const deleteSubtask = async (req: Request, res: Response) => {
    const { subtaskId } = req.params;
    const requestingUserId = new Types.ObjectId(req.user?.id);
    const username = req.user?.username;

    const isValidObjectId = Types.ObjectId.isValid(subtaskId);

    if (!isValidObjectId) {
        res.status(404).json({ message: 'Invalid Request' });
        return;
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        const subtask = await Subtask.findById(subtaskId);

        if (!subtask) {
            res.status(404).json({ message: 'Subtask not found' });
            return;
        }

        // Get the parent task
        const task = await Task.findById(subtask.taskId);
        if (task) {
            // Notify the task creator (admin)
            if (!requestingUserId.equals(task.creator)) {
                const result = await createNotification({
                    session,
                    originatorId: requestingUserId,
                    recipientId: task.creator,
                    message: `${username?.toLocaleUpperCase()} deleted the subtask ${subtask.title} of ${task.title}.`,
                    subtaskId: subtask._id as Types.ObjectId,
                });

                if (!result.success) {
                    res.status(500).json({ message: result.error || 'An error occurred while creating notification' });
                    return;
                }
            }

            // Notify the subtask creator (admin)
            if (!requestingUserId.equals(subtask.creator) && !task.creator.equals(subtask.creator)) {
                const result = await createNotification({
                    session,
                    originatorId: requestingUserId,
                    recipientId: subtask.creator,
                    message: `${username?.toLocaleUpperCase()} deleted the subtask ${subtask.title} of ${task.title}.`,
                    subtaskId: subtask._id as Types.ObjectId,
                });

                if (!result.success) {
                    res.status(500).json({ message: result.error || 'An error occurred while creating notification' });
                    return;
                }
            }

            // Notify the subtask assignees execpt the deletor
            const assignedTo = subtask.assignedTo;
            for (const userId of assignedTo) {
                if (!userId.equals(task.creator) && !userId.equals(subtask.creator) && !requestingUserId.equals(userId)) {
                    const result = await createNotification({
                        session,
                        originatorId: requestingUserId,
                        recipientId: userId,
                        message: `${username?.toLocaleUpperCase()} deleted the subtask ${subtask.title} of ${task.title}.`,
                        subtaskId: subtask._id as Types.ObjectId,
                    });

                    if (!result.success) {
                        res.status(500).json({ message: result.error || 'An error occurred while creating notification' });
                        return;
                    }
                }
            };
        }

        await subtask.deleteOne({ session });

        await session.commitTransaction();
        session.endSession()
        res.status(200).json({ deleteSubtaskId: subtask._id, message: 'Subtask deleted successfully!' });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
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
    if (status && validStatus.includes(status)) filters.status = status;

    // Validate and set `priority`
    if (priority && validPriorities.includes(priority)) filters.priority = priority;

    try {
        const { offset, limit: pageLimit } = getPagination(Number(page), Number(limit));
        const subtasks = await Subtask.find(filters)
            .sort({ createdAt: -1 })
            .skip(offset)
            .limit(pageLimit);

        const totalSubtasks = await Subtask.countDocuments(filters);
        res.status(200).json({ subtasks, totalSubtasks, page: Number(page), totalPages: Math.ceil(totalSubtasks / pageLimit), message: 'Subtak fetched succesfully!' });
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
    if (status && validStatus.includes(status)) filters.status = status;

    // Validate and set `priority`
    if (priority && validPriorities.includes(priority)) filters.priority = priority;

    try {
        const { offset, limit: pageLimit } = getPagination(Number(page), Number(limit));
        const subtasks = await Subtask.find(filters)
            .sort({ createdAt: -1 })
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
        assignedTo: userId,
        taskId: taskId
    };

    // Validate and set `status`
    if (status && validStatus.includes(status)) filters.status = status;

    // Validate and set `priority`
    if (priority && validPriorities.includes(priority)) filters.priority = priority;

    try {
        const { offset, limit: pageLimit } = getPagination(Number(page), Number(limit));
        const subtasks = await Subtask.find(filters)
            .sort({ createdAt: -1 })
            .skip(offset)
            .limit(pageLimit);

        const totalSubtasks = await Subtask.countDocuments(filters);
        res.status(200).json({ subtasks, totalSubtasks, page: Number(page), totalPages: Math.ceil(totalSubtasks / pageLimit) });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching assigned subtasks', error });
    }
};


// comments

export const addCommentToSubtask = async (req: Request, res: Response) => {
    const { subtaskId } = req.params;
    const requestingUserId = new Types.ObjectId(req.user?.id);
    const username = req.user?.username;

    const isValidObjectId = Types.ObjectId.isValid(subtaskId);
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

        const subtask = await Subtask.findById(subtaskId);
        if (!subtask) {
            res.status(404).json({ message: 'Subtask not found' });
            return;
        }

        const comment = subtask.comments.create({
            userId: requestingUserId,
            text,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        subtask.comments.push(comment);
        await subtask.save({ session });

        // Get the parent task
        const task = await Task.findById(subtask.taskId);
        if (!task) {
            res.status(500).json({ message: 'Parent Task not found' });
            return;
        }

        // Notify the task creator (admin)
        if (!requestingUserId.equals(task.creator)) {
            const result = await createNotification({
                session,
                originatorId: requestingUserId,
                recipientId: task.creator,
                message: `${username} commented ${text} on your subtask ${subtask.title} of ${task.title}.`,
                subtaskId: subtask._id as Types.ObjectId,
            });

            if (!result.success) {
                res.status(500).json({ message: result.error || 'An error occurred while creating notification' });
                return;
            }
        }

        // Notify the subtask creator (admin)
        if (!requestingUserId.equals(subtask.creator)) {
            const result = await createNotification({
                session,
                originatorId: requestingUserId,
                recipientId: subtask.creator,
                message: `${username} commented ${text} on your subtask ${subtask.title} of ${task.title}.`,
                subtaskId: subtask._id as Types.ObjectId,
            });

            if (!result.success) {
                res.status(500).json({ message: result.error || 'An error occurred while creating notification' });
                return;
            }
        }

        // Notify the subtask assignees
        const assignedTo = subtask.assignedTo;
        for (const userId of assignedTo) {
            if (!userId.equals(requestingUserId) && !userId.equals(task.creator) && !userId.equals(subtask.creator)) {
                const result = await createNotification({
                    session,
                    originatorId: requestingUserId,
                    recipientId: userId,
                    message: `${username?.toLocaleUpperCase()} commented ${text} on the subtask ${subtask.title} of ${task.title}.`,
                    subtaskId: subtask._id as Types.ObjectId,
                });

                if (!result.success) {
                    res.status(500).json({ message: result.error || 'An error occurred while creating notification' });
                    return;
                }
            }
        };

        const populatedSubtask = await Subtask.findById(subtask._id).populate({
            path: 'comments.userId',
            select: 'username email',
        }).session(session);

        if (!populatedSubtask) {
            res.status(500).json({ message: 'Failed to fetch comment after comment add!' });
            return;
        }

        const pupulatedComment = populatedSubtask.comments.id(comment._id);

        await session.commitTransaction();
        session.endSession();
        res.json({ comment: pupulatedComment, message: 'Comment added!' });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: 'Error adding comment to subtask!', error });
    }
};

// edit subtask commnet
export const editSubtaskComment = async (req: Request, res: Response) => {
    const { subtaskId, commentId } = req.params;
    const requestingUserId = new Types.ObjectId(req.user?.id);
    const { text } = req.body;

    if (!text || !Types.ObjectId.isValid(subtaskId) || !Types.ObjectId.isValid(commentId)) {
        res.status(400).json({ message: 'Invalid Request' });
        return;
    }

    try {
        const subtask = await Subtask.findById(subtaskId).populate({
            path: 'comments.userId',
            select: 'username email',
        });

        if (!subtask) {
            res.status(404).json({ message: 'Subtask not found' });
            return;
        }

        const comment = subtask.comments.id(commentId);
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
        await subtask.save();

        res.json({ editedComment: subtask.comments.id(commentId), message: 'Comment edited successfully!' });
    } catch (error) {
        res.status(500).json({ message: 'Error editing comment!', error });
    }
};

// Delete subtaskComment
export const deleteSubtaskComment = async (req: Request, res: Response) => {
    const { subtaskId, commentId } = req.params;
    const requestingUserId = new Types.ObjectId(req.user?.id);

    if (!Types.ObjectId.isValid(subtaskId) || !Types.ObjectId.isValid(commentId)) {
        res.status(400).json({ message: 'Invalid Request' });
        return;
    }

    try {
        const subtask = await Subtask.findById(subtaskId).populate({
            path: 'taskId',
            select: 'creator',
        });

        if (!subtask) {
            res.status(404).json({ message: 'Subtask not found' });
            return;
        }

        const commentIndex = subtask.comments.findIndex(
            (comment) => comment._id.toString() === commentId
        );

        if (commentIndex === -1) {
            res.status(404).json({ message: 'Comment not found' });
            return;
        }

        const task = subtask.taskId as ITask;
        if (!requestingUserId.equals(subtask.comments[commentIndex].userId) && !requestingUserId.equals(subtask.creator) && !requestingUserId.equals(task.creator)) {
            res.status(403).json({ message: 'You are not authorized to delete this comment' });
            return;
        }

        subtask.comments.splice(commentIndex, 1);
        await subtask.save();

        res.json({ deletedCommentId: commentId, message: 'Comment deleted successfully!' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting comment', error });
    }
};

// get all subtask comments
export const getAllCommentsForSubtask = async (req: Request, res: Response) => {
    const { subtaskId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const isValidObjectId = Types.ObjectId.isValid(subtaskId);
    if (!isValidObjectId) {
        res.status(404).json({ message: 'Invalid Request' });
        return;
    }

    try {
        const { offset, limit: pageLimit } = getPagination(Number(page), Number(limit));

        const subtask = await Subtask.findById(subtaskId).populate({
            path: 'comments.userId',
            select: 'username email',
        });

        if (!subtask) {
            res.status(404).json({ message: 'Subtask not found!' });
            return;
        }

        const totalComments = subtask.comments.length;
        const paginatedComments = subtask.comments
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(offset, Number(page) * pageLimit);

        res.json({
            comments: paginatedComments,
            totalComments,
            page: Number(page),
            totalPages: Math.ceil(totalComments / pageLimit),
            message: 'Comments fetched successfully!',
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching comments for subtask', error });
    }
};
