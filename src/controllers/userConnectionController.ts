import { Request, Response } from 'express';
import User from '../models/userModel';
import mongoose, { Types } from 'mongoose';

export const addUserConnection = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const { connectionUsername } = req.body;

        const connectionUser = await User.findOne({ username: connectionUsername });
        if (!connectionUser) {
            res.status(404).json({ message: 'Connection user not found' });
            return;
        }
        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        if (user.username === connectionUsername) {
            res.status(400).json({ message: 'Cannot connect to yourself' });
            return;
        }

        if (user.userConnection.includes(connectionUser._id)) {
            res.status(409).json({ message: 'Connection already exists' });
            return;
        }

        // Add the connection to the user
        user.userConnection.push(connectionUser._id);
        await user.save();

        res.status(200).json({ newConnection: connectionUser, message: 'New connection added succesfully!' });
    } catch (error) {
        res.status(500).json({ message: 'Error adding connection', error });
    }
};

// Get all user connections
export const getUserConnections = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;

        const user = await User.findById(userId).populate('userConnection');
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        res.status(200).json({ connections: user.userConnection });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching connections', error });
    }
};

// Delete a user connection using the connection ID passed in params
export const deleteUserConnection = async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { connectionId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
    }

    const isValidObjectId = Types.ObjectId.isValid(connectionId);
    if (!isValidObjectId) {
        res.status(404).json({ message: 'Invalid Request' });
        return;
    }

    try {
        // Correctly convert connectionId to ObjectId
        const connectionObjectId = new mongoose.Types.ObjectId(connectionId);

        // Check if the connection exists
        const connectionIndex = user.userConnection.indexOf(connectionObjectId);
        if (connectionIndex === -1) {
            res.status(404).json({ message: 'Connection user not found' });
            return;
        }

        // Remove the connection
        user.userConnection.splice(connectionIndex, 1);
        await user.save();

        res.status(200).json({ id: connectionObjectId, message: 'Connection removed successfully!' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting connection', error });
    }
};
