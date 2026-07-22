import dotenv from 'dotenv';
import { slackPublisher } from '../services/notifications/slack/slackPublisher.js';

dotenv.config({ quiet: true });

const webhookUrl = process.env.SLACK_WEBHOOK_URL;

if (!webhookUrl) {
  console.error('❌ Error: SLACK_WEBHOOK_URL environment variable is not defined in .env');
  console.log('Please add your incoming webhook URL, for example:');
  console.log('SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR_WEBHOOK_HERE');
  console.log('in your .env file at the root of the project.');
  process.exit(1);
}

const mockNotification = {
  title: '🚨 Critical Risk: Session Bypass Vulnerability detected',
  repository: 'SPARTAN-04/Code-Sense-Ai',
  pullNumber: 104,
  riskScore: 9.2,
  severity: 'CRITICAL',
  confidence: 95,
  templateName: 'Critical Alert',
  affectedSystems: ['auth-service', 'jwt-middleware'],
  summary: 'PR #104 introduces an evaluation bypass where JWT checking is completely ignored on checkout paths. Downstream payments module is directly exposed to unauthenticated traffic.',
  prUrl: 'https://github.com/SPARTAN-04/Code-Sense-Ai/pull/104'
};

async function testSlack() {
  console.log('Pushing test Slack notification to webhook:', webhookUrl);
  try {
    const result = await slackPublisher.publish({
      webhookUrl,
      notification: mockNotification
    });
    console.log('✅ Slack notification sent successfully!');
    console.log('Result:', result);
  } catch (error) {
    console.error('❌ Slack notification failed!');
    console.error('Error Details:', error.message);
    if (error.responseBody) {
      console.error('Response Body:', error.responseBody);
    }
    process.exit(1);
  }
}

testSlack();
