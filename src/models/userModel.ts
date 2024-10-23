import mongoose, { Document, Schema, Types } from 'mongoose';

// Define the User interface extending mongoose Document
export interface IUser extends Document {
    _id: Types.ObjectId;  
    username: string;
    email: string;
    password: string;
    role: 'admin' | 'user';  
}

// Create a User Schema
const userSchema: Schema<IUser> = new Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        password: {
            type: String,
            required: true,
            minlength: 6, // Minimum length for password
        },
        role: {
            type: String,
            enum: ['admin', 'user'], // Role can only be 'admin' or 'user'
            default: 'user', // Default role is 'user'
        },
    },
    {
        timestamps: true, // Automatically manage createdAt and updatedAt fields
    }
);

// Create the User model
const User = mongoose.model<IUser>('User', userSchema);

export default User; // Export the User model
