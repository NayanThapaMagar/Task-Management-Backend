import mongoose, { Schema, Document, Types } from 'mongoose';

interface Comment {
    userId: Types.ObjectId;
    text: string;
    createdAt: Date;
}

export interface ITask extends Document {
    title: string;
    description: string;
    status: 'to do' | 'pending' | 'completed';
    priority: 'low' | 'medium' | 'high';
    creator: Types.ObjectId;  // User who created the task (Admin)
    assignedTo: Types.ObjectId[];  // Users assigned to the task
    comments: Comment[];
}

const taskSchema = new Schema<ITask>(
    {
        title: { type: String, required: true },
        description: { type: String, required: true },
        status: { type: String, enum: ['to do', 'pending', 'completed'], default: 'to do' },
        priority: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
        creator: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        assignedTo: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        comments: [
            {
                userId: { type: Schema.Types.ObjectId, ref: 'User' },
                text: { type: String, required: true },
                createdAt: { type: Date, default: Date.now },
            },
        ],
    },
    { timestamps: true }
);

const Task = mongoose.model<ITask>('Task', taskSchema);

export default Task;
