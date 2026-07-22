import express from 'express';
import crypto from 'crypto';
import { config } from '../config/env.js';
import { handleGithubWebhook } from '../controllers/webhook.controller.js';

const router = express.Router();

/**
 * Webhook signature verification middleware
 */
function verifyWebhookSignature(req, res, next) {
  const signature = req.headers['x-hub-signature-256'];
  const secret = config.github.webhookSecret;

  if (!secret) {
    console.warn('WARNING: GITHUB_WEBHOOK_SECRET is not configured. Webhook signature verification is skipped.');
    return next();
  }

  if (!signature) {
    console.error('Webhook signature verification failed: Missing x-hub-signature-256 header.');
    return res.status(401).json({ success: false, message: 'Missing signature header' });
  }

  if (!req.rawBody) {
    console.error('Webhook signature verification failed: Raw request body is empty/missing.');
    return res.status(400).json({ success: false, message: 'Missing request body' });
  }

  try {
    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(req.rawBody).digest('hex');

    const signatureBuffer = Buffer.from(signature);
    const digestBuffer = Buffer.from(digest);

    if (
      signatureBuffer.length !== digestBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, digestBuffer)
    ) {
      console.error('Webhook signature verification failed: Signatures do not match.');
      return res.status(401).json({ success: false, message: 'Invalid signature' });
    }
  } catch (error) {
    console.error('Webhook signature verification error:', error);
    return res.status(401).json({ success: false, message: 'Signature validation error' });
  }

  next();
}

/**
 * Test route
 */
router.get('/test', (req, res) => {
  console.log('✅ Webhook test route hit');

  return res.status(200).json({
    success: true,
    message: 'Webhook route working correctly',
  });
});

/**
 * GitHub webhook route
 */
router.post('/github', verifyWebhookSignature, handleGithubWebhook);

export default router;