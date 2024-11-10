import express from 'express';
import { addUserConnection, getUserConnections, deleteUserConnection } from '../controllers/userConnectionController';
import { authenticateUser } from '../middlewares/authMiddleware';  

const router = express.Router();


router.post('/', authenticateUser, addUserConnection);

router.get('/', authenticateUser, getUserConnections);

router.delete('/:connectionId', authenticateUser, deleteUserConnection);

export default router;
