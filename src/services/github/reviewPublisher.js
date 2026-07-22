import {
  buildCheckRunPayload,
  formatReviewComment,
  formatSummaryComment,
  getReviewCommentMarker,
  getSummaryCommentMarker,
} from './commentFormatter.js';
import { githubClient } from './githubClient.js';
import { reviewHistoryService } from '../history/reviewHistoryService.js';
import { generatePRSummary } from '../summary/summaryGenerator.js';

export class ReviewPublisher {
  constructor({
    client = githubClient,
    historyService = reviewHistoryService,
    summaryGenerator = generatePRSummary,
  } = {}) {
    this.client = client;
    this.historyService = historyService;
    this.summaryGenerator = summaryGenerator;
  }

  canPublish(state) {
    const repository = state.repository || {};

    return Boolean(
      repository.source === 'github' &&
      repository.installationId &&
      repository.owner &&
      repository.repo &&
      repository.pullNumber
    );
  }

  async publish(state) {
    if (!this.canPublish(state)) {
      return {
        status: 'skipped',
        reason: 'State does not describe a GitHub pull request.',
      };
    }

    const repository = state.repository;
    const summary = this.summaryGenerator(state);
    const reviewCommentBody = formatReviewComment(state);
    const summaryCommentBody = formatSummaryComment(state, summary);
    const checkRunPayload = buildCheckRunPayload(state, summary);

    const reviewComment = await this.client.createOrUpdateIssueComment({
      installationId: repository.installationId,
      owner: repository.owner,
      repo: repository.repo,
      issueNumber: repository.pullNumber,
      marker: getReviewCommentMarker(),
      body: reviewCommentBody,
    });

    const summaryComment = await this.client.createOrUpdateIssueComment({
      installationId: repository.installationId,
      owner: repository.owner,
      repo: repository.repo,
      issueNumber: repository.pullNumber,
      marker: getSummaryCommentMarker(),
      body: summaryCommentBody,
    });

    const checkRun = await this.client.createCheckRun({
      installationId: repository.installationId,
      owner: repository.owner,
      repo: repository.repo,
      headSha: repository.headSha || repository.ref,
      name: checkRunPayload.name,
      conclusion: checkRunPayload.conclusion,
      output: {
        title: checkRunPayload.title,
        summary: checkRunPayload.summary,
        text: checkRunPayload.text,
      },
    });

    const history = await this.historyService.recordReviewHistory({
      prNumber: repository.pullNumber,
      repository: `${repository.owner}/${repository.repo}`,
      riskScore: state.riskScore,
      confidence: state.confidence,
      severity: state.severity,
      summary,
      details: buildDashboardDetails(state),
    });

    return {
      status: 'published',
      reviewComment: {
        ...reviewComment,
        body: reviewCommentBody,
      },
      summaryComment: {
        ...summaryComment,
        body: summaryCommentBody,
      },
      checkRun: {
        ...checkRun,
        statusLabel: checkRunPayload.status,
      },
      checkRunStatus: checkRunPayload.status,
      reviewHistoryId: history.id || null,
      reviewHistorySkipped: Boolean(history.skipped),
      summary,
    };
  }
}

export const reviewPublisher = new ReviewPublisher();

function buildDashboardDetails(state) {
  const repository = state.repository || {};

  return {
    title: state.reviewSummary?.headline || `PR #${repository.pullNumber}`,
    prUrl:
      repository.pullRequestUrl ||
      `https://github.com/${repository.owner}/${repository.repo}/pull/${repository.pullNumber}`,
    headSha: repository.headSha || repository.ref || null,
    riskLevel: state.riskLevel || state.severity,
    reviewMode: state.reviewMode || null,
    affectedSystems: state.reviewSummary?.affectedSystems || [],
    architectureImpact: state.reviewSummary?.architectureImpact || 'NOT_ANALYZED',
    architectureFindings: state.reviewSummary?.topFindings || [],
    criticalFiles: state.criticalFiles || [],
    suggestedChanges:
      state.reviewSummary?.suggestedChanges ||
      state.reviewSummary?.suggestedNextSteps ||
      [],
    hotspots: state.hotspots || [],
    smartReview: state.smartReview || null,
    dependencyGraph: state.dependencyGraph || { nodes: [], edges: [] },
    architectureAnalysis: state.architectureAnalysis || null,
    changedFiles: state.changedFiles || [],
    notificationStatus: state.notificationStatus || null,
  };
}
