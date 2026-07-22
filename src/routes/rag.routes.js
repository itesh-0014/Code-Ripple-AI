import express from 'express';
import {
  indexLocalRepository,
  searchLocalRepository,
} from '../controllers/rag.controller.js';

const router = express.Router();

router.post('/local/index', indexLocalRepository);
router.post('/local/search', searchLocalRepository);

export default router; 
