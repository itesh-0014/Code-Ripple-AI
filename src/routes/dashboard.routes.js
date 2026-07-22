import express from 'express';
import {
  getAnalytics,
  getArchitecture,
  getDependencyGraph,
  getReviewJobs,
  getReviewSettings,
  getReview,
  getUserProfile,
  getWebhookDeliveries,
  listRepositories,
  listReviews,
  reanalyzeReview,
} from '../controllers/dashboard.controller.js';
import { requireSession } from '../middleware/session.middleware.js';

const router = express.Router();

router.use(requireSession);
router.get('/reviews', listReviews);
router.get('/reviews/:id', getReview);
router.post('/reviews/:id/reanalyze', reanalyzeReview);
router.get('/repositories', listRepositories);
router.get('/analytics', getAnalytics);
router.get('/architecture', getArchitecture);
router.get('/dependency-graph', getDependencyGraph);
router.get('/user/profile', getUserProfile);
router.get('/review-jobs', getReviewJobs);
router.get('/webhook-deliveries', getWebhookDeliveries);
router.get('/settings/review', getReviewSettings);

export default router;
