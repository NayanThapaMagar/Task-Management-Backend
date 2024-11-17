import mongoose, { Schema, Document, Types } from 'mongoose';

// Define the interface for the notification document
interface INotification extends Document {
  originatorId: Types.ObjectId;
  recipientId: Types.ObjectId;
  message: string;
  taskId?: Types.ObjectId;
  subtaskId?: Types.ObjectId;
  isRead: boolean;
  createdAt: Date;
}

// Define the schema for notifications
const NotificationSchema = new Schema<INotification>(
  {
    originatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task' },
    subtaskId: { type: Schema.Types.ObjectId, ref: 'Subtask' },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// **Indexes for Query Optimization**
NotificationSchema.index({ userId: 1, isRead: 1 });

// **Validation Logic: Ensure either taskId or subtaskId exists**
NotificationSchema.pre('save', function (next) {
  if (!this.taskId && !this.subtaskId) {
    return next(new Error('A notification must be linked to either a Task or a Subtask.'));
  }
  next();
});

// **Virtuals for Populating Data** (e.g., task or subtask details)
NotificationSchema.virtual('task', {
  ref: 'Task',
  localField: 'taskId',
  foreignField: '_id',
  justOne: true,
});

NotificationSchema.virtual('subtask', {
  ref: 'Subtask',
  localField: 'subtaskId',
  foreignField: '_id',
  justOne: true,
});

// Ensure virtual fields are included when converting documents to JSON
NotificationSchema.set('toObject', { virtuals: true });
NotificationSchema.set('toJSON', { virtuals: true });

// Create and export the Notification model
const Notification = mongoose.model<INotification>('Notification', NotificationSchema);

export default Notification;
