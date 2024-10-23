import { Request, Response, RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/userModel';
import { validateEmail } from '../utils/validation';

export const registerUser: RequestHandler = async (req: Request, res: Response) => {
    const { username, email, password } = req.body;

    // Check if the email format is valid
    if (!validateEmail(email)) {
        res.status(400).json({ message: 'Invalid email' });
        return;
    }

    try {
        const existingUser = await User.findOne({ email }) || await User.findOne({ username });
        if (existingUser) {
            res.status(400).json({ message: 'User already exists' });
            return;
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({ username, email, password: hashedPassword });
        const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET || '', {
            expiresIn: '1h',
        });
        res.status(201).json({ token, user: { id: newUser._id, username, email } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Login User
export const loginUser: RequestHandler = async (req: Request, res: Response) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) {
            res.status(400).json({ message: 'Invalid credentials' });
            return;
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            res.status(400).json({ message: 'Invalid credentials' });
            return;
        }
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || '', {
            expiresIn: '1h',
        });
        res.status(200).json({ token, user: { id: user._id, username: user.username, email: user.email } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
