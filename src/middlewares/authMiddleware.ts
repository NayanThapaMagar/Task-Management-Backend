import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/userModel';

interface DecodedToken {
    id: string;
    iat: number;
    exp: number;
}

export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        res.status(401).json({ message: 'Authentication failed: No token provided' });
        return;
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || '') as DecodedToken;

        const user = await User.findById(decoded.id);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        // Attach user to the request object for further use in controllers
        req.user = { id: user._id.toString(), username: user.username };
        // req.user = { id: user._id.toString(), role: user.role };

        next();
    } catch (error) {
        res.status(401).json({ message: 'Authentication failed: Invalid token' });
        return;
    }
};
