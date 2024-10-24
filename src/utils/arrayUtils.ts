import { Types } from 'mongoose';
// Helper function to compare arrays irrespective of order
export const arraysEqual = (arr1: Types.ObjectId[], arr2: Types.ObjectId[]): boolean => {
    if (arr1.length !== arr2.length) return false;

    const sortedArr1 = arr1.map((val) => val.toString()).sort();
    const sortedArr2 = arr2.map((val) => val.toString()).sort();

    return sortedArr1.every((val, index) => val === sortedArr2[index]);
};