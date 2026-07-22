import express from 'express';
import {
  completeGitHubOAuth,
  startGitHubOAuth,
} from '../controllers/auth.controller.js';

const router = express.Router();

router.get('/github', startGitHubOAuth);
router.get('/github/callback', completeGitHubOAuth);

export default router;
