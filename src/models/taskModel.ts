import mongoose, { Schema, Document, Types } from 'mongoose';

export interface Comment {
    userId: Types.ObjectId; // commenter
    text: string;
    createdAt: Date;
    updatedAt: Date;
}

const commentSchema = new Schema<Comment>({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

export interface ITask extends Document {
    title: string;
    description: string;
    status: 'to do' | 'pending' | 'completed';
    priority: 'low' | 'medium' | 'high';
    creator: Types.ObjectId; 
    assignedTo: Types.ObjectId[]; 
    comments: Types.DocumentArray<Comment>;
}

const taskSchema = new Schema<ITask>(
    {
        title: { type: String, required: true },
        description: { type: String, required: true },
        status: { type: String, enum: ['to do', 'pending', 'completed'], default: 'to do' },
        priority: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
        creator: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        assignedTo: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        comments: [commentSchema],
    },
    { timestamps: true }
);

const Task = mongoose.model<ITask>('Task', taskSchema);

export default Task;
