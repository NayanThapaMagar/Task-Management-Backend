import mongoose, { Schema, Document, Types } from 'mongoose';
import { ITask, Comment } from './taskModel';

const commentSchema = new Schema<Comment>({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

export interface ISubtask extends Document {
    title: string;
    description: string;
    status: 'to do' | 'pending' | 'completed';
    priority: 'low' | 'medium' | 'high';
    creator: Types.ObjectId;
    assignedTo: Types.ObjectId[];
    comments: Types.DocumentArray<Comment>;
    taskId: Types.ObjectId | ITask;
}

const subtaskSchema = new Schema<ISubtask>(
    {
        title: { type: String, required: true },
        description: { type: String, required: true },
        status: { type: String, enum: ['to do', 'pending', 'completed'], default: 'to do' },
        priority: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
        creator: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        assignedTo: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        comments: [commentSchema],
        taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
    },
    { timestamps: true }
);

const Subtask = mongoose.model<ISubtask>('Subtask', subtaskSchema);

export default Subtask;
