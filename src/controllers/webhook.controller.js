  import { githubService } from '../services/github.service.js';
  import { buildReviewOptions } from '../services/dashboard/review-options.util.js';
  import {
    completeReviewJob,
    failReviewJob,
    startReviewJob,
    updateReviewJob,
  } from '../services/dashboard/review-job.store.js';
  import { recordWebhookDelivery } from '../services/dashboard/webhook-delivery.store.js';
  import { reviewHistoryService } from '../services/history/reviewHistoryService.js';
  import { prReviewOrchestratorService } from '../services/orchestration/pr-review-orchestrator.service.js';
  import { logPhase2Report } from '../utils/phase2-report.logger.js';
  import { logPhase3Report } from '../utils/phase3-report.logger.js';
  import { logPhase4Report } from '../utils/phase4-report.logger.js';
  import { logPhase5Report } from '../utils/phase5-report.logger.js';
  import { logPhase6Report } from '../utils/phase6-report.logger.js';

  export const handleGithubWebhook = async (req, res) => {
    console.log('\n================ GITHUB WEBHOOK RECEIVED ================');

    try {
      const event = req.headers['x-github-event'];
      const deliveryId = req.headers['x-github-delivery'];
      const payload = req.body;
      const repositoryName = payload.repository?.full_name || null;

      console.log(`Event Type: ${event}`);
      console.log(`Delivery ID: ${deliveryId}`);
      await recordWebhookDelivery({
        deliveryId,
        event,
        action: payload.action,
        repository: repositoryName,
        status: 'received',
      });

      if (event === 'ping') {
        console.log('GitHub webhook connected successfully.');
        return res.status(200).send('pong');
      }

      if (event === 'installation') {
        console.log(`Installation Event: ${payload.action}`);
        return res.status(200).send('Installation event received');
      }

      if (event === 'installation_repositories') {
        console.log(`Repository Installation Updated: ${payload.action}`);

        if (payload.repositories_added?.length) {
          console.log('Added repositories:');

          payload.repositories_added.forEach(repo => {
            console.log(`   - ${repo.full_name}`);
          });
        }

        if (payload.repositories_removed?.length) {
          console.log('Removed repositories:');

          payload.repositories_removed.forEach(repo => {
            console.log(`   - ${repo.full_name}`);
          });
        }

        return res.status(200).send('Repository installation updated');
      }

      if (event === 'pull_request') {
        const action = payload.action;

        console.log(`Pull Request Action: ${action}`);

        if (['opened', 'synchronize', 'reopened'].includes(action)) {
          const pr = payload.pull_request;
          const repo = payload.repository;
          const installationId = payload.installation?.id;

          console.log('\nPR EVENT DETECTED');
          console.log(`Repository: ${repo.full_name}`);
          console.log(`PR Number: #${pr.number}`);
          console.log(`Title: ${pr.title}`);
          console.log(`Author: ${pr.user.login}`);

          if (!installationId) {
            console.warn('Missing installation ID');
            return res.status(200).send('Ignored');
          }

          processPullRequest({
            deliveryId,
            installationId,
            owner: repo.owner.login,
            repo: repo.name,
            pullNumber: pr.number,
            headSha: pr.head?.sha,
            title: pr.title,
          }).catch(error => {
            console.error('Async PR processing failed:', error);
          });
        }

        return res.status(200).send('Pull request event received');
      }

      console.log(`Ignored Event: ${event}`);

      return res.status(200).send('Event ignored');
    } catch (error) {
      console.error('\nWEBHOOK ERROR');
      console.error(error);

      return res.status(500).send('Internal Server Error');
    }
  };

  async function processPullRequest({
    deliveryId,
    installationId,
    owner,
    repo,
    pullNumber,
    headSha,
    title,
  }) {
    const job = startReviewJob({ owner, repo, pullNumber, title, deliveryId });
    try {
      console.log(`\nFetching changed files for ${owner}/${repo}#${pullNumber}`);
      updateReviewJob(job.id, { stage: 'fetching-files', progress: 15 });

      const files = await githubService.getPRFiles(
        installationId,
        owner,
        repo,
        pullNumber
      );

      console.log(`\nFound ${files.length} changed files:\n`);

      files.forEach(file => {
        console.log(
          `- [${file.status}] ${file.filename} (+${file.additions} / -${file.deletions})`
        );
      });

      console.log('\nStarting Phase 6 LangGraph orchestration...');
      updateReviewJob(job.id, { stage: 'analyzing', progress: 35 });

      const phase6Report = await prReviewOrchestratorService.reviewPullRequest({
        installationId,
        owner,
        repo,
        pullNumber,
        ref: headSha,
        changedFiles: files,
        ...buildReviewOptions(),
      });
      updateReviewJob(job.id, { stage: 'persisting', progress: 85 });

      logPhase2Report(phase6Report);
      logPhase3Report(phase6Report);
      logPhase4Report(phase6Report);
      logPhase5Report(phase6Report);
      logPhase6Report(phase6Report);
      const history = await persistReviewReport({
        phase6Report,
        installationId,
        owner,
        repo,
        pullNumber,
        headSha,
        changedFiles: files,
      });
      completeReviewJob(job.id, { reviewHistoryId: history?.id || phase6Report.reviewHistoryId || null });
      await recordWebhookDelivery({
        deliveryId,
        event: 'pull_request',
        action: 'processed',
        repository: `${owner}/${repo}`,
        status: 'completed',
        message: history?.id ? `Review history ${history.id}` : 'Review completed',
      });
    } catch (error) {
      failReviewJob(job.id, error);
      await recordWebhookDelivery({
        deliveryId,
        event: 'pull_request',
        action: 'processed',
        repository: `${owner}/${repo}`,
        status: 'failed',
        message: error.message,
      });
      console.error('\nError processing pull request');
      console.error(error);
    }
  }

  async function persistReviewReport({
    phase6Report,
    installationId,
    owner,
    repo,
    pullNumber,
    headSha,
    changedFiles,
  }) {
    if (phase6Report.reviewHistoryId) {
      console.log(`Review history already recorded: ${phase6Report.reviewHistoryId}`);
      return { id: phase6Report.reviewHistoryId, skipped: false };
    }

    const summary = phase6Report.reviewSummary || {};
    const history = await reviewHistoryService.recordReviewHistory({
      prNumber: pullNumber,
      repository: `${owner}/${repo}`,
      riskScore: phase6Report.riskScore ?? summary.riskScore ?? 0,
      confidence: phase6Report.confidence ?? summary.confidence ?? 0,
      severity: phase6Report.severity || summary.severity || 'LOW',
      summary,
      details: {
        title: summary.headline || `PR #${pullNumber}`,
        prUrl: `https://github.com/${owner}/${repo}/pull/${pullNumber}`,
        installationId,
        headSha: headSha || null,
        riskLevel: phase6Report.riskLevel || summary.riskLevel || phase6Report.severity,
        reviewMode: phase6Report.reviewMode || summary.reviewMode || null,
        affectedSystems: phase6Report.affectedSystems || summary.affectedSystems || [],
        architectureImpact: phase6Report.architectureImpact || 'NOT_ANALYZED',
        architectureFindings: summary.topFindings || [],
        criticalFiles: phase6Report.criticalFiles || [],
        suggestedChanges:
          phase6Report.suggestedChanges ||
          summary.suggestedChanges ||
          summary.suggestedNextSteps ||
          [],
        hotspots: phase6Report.hotspots || [],
        smartReview: phase6Report.smartReview || null,
        dependencyGraph: phase6Report.graph || { nodes: [], edges: [] },
        architectureAnalysis: phase6Report.architectureAnalysis || null,
        changedFiles,
        notificationStatus: phase6Report.notificationStatus || null,
        githubPublicationStatus: phase6Report.githubPublicationStatus || null,
        checkRunStatus: phase6Report.checkRunStatus || null,
        readableReport: phase6Report.aiReview?.readableReport || null,
        aiReview: phase6Report.aiReview || null,
      },
    });

    console.log(
      history.skipped
        ? `Review history skipped: ${history.reason}`
        : `Review history recorded: ${history.id}`
    );
    return history;
  }
