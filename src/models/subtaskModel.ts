import mongoose, { Schema, Document, Types } from 'mongoose';

interface Comment {
    userId: Types.ObjectId;
    text: string;
    createdAt: Date;
}

export interface ISubtask extends Document {
    title: string;
    description: string;
    status: 'to do' | 'pending' | 'completed';
    priority: 'low' | 'medium' | 'high';
    creator: Types.ObjectId; 
    assignedTo: Types.ObjectId[];
    comments: Comment[];
    taskId: Types.ObjectId;
}

const subtaskSchema = new Schema<ISubtask>(
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
        taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true },  // Link to the parent task
    },
    { timestamps: true }
);

const Subtask = mongoose.model<ISubtask>('Subtask', subtaskSchema);

export default Subtask;
