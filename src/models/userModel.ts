import mongoose, { Document, Schema, Types } from 'mongoose';

// Define the User interface extending mongoose Document
export interface IUser extends Document {
    _id: Types.ObjectId;
    username: string;
    email: string;
    password: string;
    userConnection: Types.ObjectId[];
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
            minlength: 6,
        },
        userConnection: [{
            type: Schema.Types.ObjectId,
            ref: 'User'
        }],
    },
    {
        timestamps: true,
    }
);

const User = mongoose.model<IUser>('User', userSchema);

export default User; 
