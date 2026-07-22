import { dashboardService, isValidReviewId } from '../services/dashboard/dashboard.service.js';
import { listReviewJobs } from '../services/dashboard/review-job.store.js';
import { listWebhookDeliveries } from '../services/dashboard/webhook-delivery.store.js';
import { config } from '../config/env.js';

export async function listReviews(req, res, next) {
  try {
    return res.json({
      success: true,
      data: await dashboardService.listReviews(req.query),
    });
  } catch (error) {
    return next(error);
  }
}

export async function getReview(req, res, next) {
  try {
    if (!isValidReviewId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid review ID.' });
    }

    const review = await dashboardService.getReview(req.params.id);
    return review
      ? res.json({ success: true, data: review })
      : res.status(404).json({ success: false, message: 'Review not found.' });
  } catch (error) {
    return next(error);
  }
}

export async function listRepositories(_req, res, next) {
  try {
    return res.json({ success: true, data: await dashboardService.getRepositories(_req.user) });
  } catch (error) {
    return next(error);
  }
}

export async function getAnalytics(req, res, next) {
  try {
    return res.json({ success: true, data: await dashboardService.getAnalytics(req.user) });
  } catch (error) {
    return next(error);
  }
}

export async function getArchitecture(_req, res, next) {
  try {
    return res.json({
      success: true,
      data: await dashboardService.getArchitectureInsights(),
    });
  } catch (error) {
    return next(error);
  }
}

export async function getDependencyGraph(req, res, next) {
  try {
    return res.json({
      success: true,
      data: await dashboardService.getDependencyGraph(req.query.repository),
    });
  } catch (error) {
    return next(error);
  }
}

export async function getUserProfile(req, res, next) {
  try {
    return res.json({
      success: true,
      data: await dashboardService.getUserProfile(req.user),
    });
  } catch (error) {
    return next(error);
  }
}

export async function getReviewJobs(_req, res, next) {
  try {
    return res.json({ success: true, data: listReviewJobs() });
  } catch (error) {
    return next(error);
  }
}

export async function getWebhookDeliveries(_req, res, next) {
  try {
    return res.json({
      success: true,
      data: await listWebhookDeliveries({ limit: 50 }),
    });
  } catch (error) {
    return next(error);
  }
}

export async function getReviewSettings(_req, res, next) {
  try {
    return res.json({
      success: true,
      data: {
        mode: config.review.mode,
        includeAiReview: config.review.includeAiReview,
        includeSemanticContext: config.review.includeSemanticContext,
        geminiRetries: config.review.geminiRetries,
        geminiTimeoutMs: config.review.geminiTimeoutMs,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function reanalyzeReview(req, res, next) {
  try {
    if (!isValidReviewId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid review ID.' });
    }

    const result = await dashboardService.reanalyzeReview(req.params.id);
    return res.status(202).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
}
