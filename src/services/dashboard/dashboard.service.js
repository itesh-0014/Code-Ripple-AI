import { ObjectId } from 'mongodb';
import { config } from '../../config/env.js';
import { reviewHistoryService } from '../history/reviewHistoryService.js';
import { gitHubUserRepositoryService } from '../github/user-repository.service.js';
import { githubService } from '../github.service.js';
import { prReviewOrchestratorService } from '../orchestration/pr-review-orchestrator.service.js';
import { buildReviewOptions } from './review-options.util.js';
import {
  completeReviewJob,
  failReviewJob,
  startReviewJob,
  updateReviewJob,
} from './review-job.store.js';
import { demoReviews, demoUser } from './demo-dashboard.data.js';

export class DashboardService {
  constructor({
    historyService = reviewHistoryService,
    repositoryService = gitHubUserRepositoryService,
    demoMode = config.dashboard.demoMode,
  } = {}) {
    this.historyService = historyService;
    this.repositoryService = repositoryService;
    this.demoMode = demoMode;
  }

  async listReviews(filters = {}) {
    const reviews = await this.loadReviews();
    const search = String(filters.search || '').trim().toLowerCase();
    const severity = String(filters.severity || '').toUpperCase();
    const repository = String(filters.repository || '').toLowerCase();
    const from = filters.from ? new Date(filters.from) : null;
    const to = filters.to ? new Date(filters.to) : null;
    const page = positiveInteger(filters.page, 1);
    const pageSize = Math.min(100, positiveInteger(filters.pageSize, 20));

    const filtered = reviews.filter(review => {
      const createdAt = new Date(review.createdAt);
      const matchesSearch =
        !search ||
        String(review.prNumber).includes(search) ||
        String(review.repository).toLowerCase().includes(search) ||
        String(review.title || '').toLowerCase().includes(search);

      return (
        matchesSearch &&
        (!severity || normalizeSeverity(review.severity) === severity) &&
        (!repository || String(review.repository).toLowerCase() === repository) &&
        (!from || createdAt >= from) &&
        (!to || createdAt <= endOfDay(to))
      );
    });
    const start = (page - 1) * pageSize;

    return {
      items: filtered.slice(start, start + pageSize).map(normalizeReview),
      pagination: {
        page,
        pageSize,
        total: filtered.length,
        totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
      },
    };
  }

  async getReview(id) {
    const reviews = await this.loadReviews();
    const review = reviews.find(item => String(item._id) === String(id));
    return review ? normalizeReview(review, { detail: true }) : null;
  }

  async getRepositories(user = null) {
    const reviews = await this.loadReviews();
    const repositories = new Map();

    if (user && !user.demo) {
      const githubRepositories = await this.repositoryService.listRepositoriesForUser(user);
      for (const repository of githubRepositories) {
        repositories.set(repository.name, { ...repository, totalRisk: 0 });
      }
    }

    for (const review of reviews) {
      const existing = repositories.get(review.repository) || {
        id: review.repository,
        name: review.repository,
        connected: true,
        reviewCount: 0,
        totalRisk: 0,
        criticalReviews: 0,
        lastReviewAt: null,
      };
      existing.reviewCount += 1;
      existing.totalRisk += Number(review.riskScore) || 0;
      existing.criticalReviews += normalizeSeverity(review.severity) === 'CRITICAL' ? 1 : 0;
      existing.lastReviewAt =
        !existing.lastReviewAt || new Date(review.createdAt) > new Date(existing.lastReviewAt)
          ? review.createdAt
          : existing.lastReviewAt;
      repositories.set(review.repository, existing);
    }

    return [...repositories.values()]
      .map(repository => ({
        ...repository,
        averageRisk: repository.reviewCount
          ? round(repository.totalRisk / repository.reviewCount)
          : 0,
        totalRisk: undefined,
      }))
      .sort((left, right) => new Date(right.lastReviewAt) - new Date(left.lastReviewAt));
  }

  async getAnalytics(user = null) {
    const reviews = await this.loadReviews();
    const repositories = await this.getRepositories(user);
    const normalized = reviews.map(normalizeReview);
    const totals = {
      repositories: repositories.length,
      reviews: normalized.length,
      criticalReviews: normalized.filter(review => review.severity === 'CRITICAL').length,
      averageRisk: average(normalized.map(review => review.riskScore)),
      averageConfidence: average(normalized.map(review => review.confidence)),
    };

    return {
      totals,
      riskTrend: groupByDate(normalized, review => review.riskScore),
      confidenceTrend: groupByDate(normalized, review => review.confidence),
      reviewVolume: groupByDate(normalized, () => 1, 'sum'),
      riskDistribution: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(severity => ({
        name: severity,
        value: normalized.filter(review => review.severity === severity).length,
      })),
      recentReviews: normalized.slice(0, 6),
    };
  }

  async getArchitectureInsights() {
    const reviews = await this.loadReviews();
    const systemCounts = countValues(reviews.flatMap(review => review.affectedSystems || []));
    const moduleScores = new Map();

    for (const review of reviews) {
      for (const file of review.criticalFiles || []) {
        const path = typeof file === 'string' ? file : file.file || file.path;
        if (!path) continue;
        const current = moduleScores.get(path) || { name: path, reviews: 0, totalRisk: 0 };
        current.reviews += 1;
        current.totalRisk += Number(review.riskScore) || 0;
        moduleScores.set(path, current);
      }
    }

    const riskyModules = [...moduleScores.values()]
      .map(module => ({
        ...module,
        averageRisk: round(module.totalRisk / module.reviews),
      }))
      .sort((left, right) => right.averageRisk - left.averageRisk)
      .slice(0, 10);

    return {
      impactedSystems: topCounts(systemCounts),
      riskyModules,
      frequentlyModified: riskyModules
        .slice()
        .sort((left, right) => right.reviews - left.reviews)
        .slice(0, 8),
      hotspots: reviews
        .flatMap(review => review.hotspots || [])
        .slice(0, 12),
    };
  }

  async getDependencyGraph(repository) {
    const reviews = await this.loadReviews();
    const review = reviews.find(item => !repository || item.repository === repository);

    return {
      repository: review?.repository || repository || null,
      reviewId: review?._id ? String(review._id) : null,
      graph: normalizeGraph(review?.dependencyGraph),
      impactedFiles: (review?.criticalFiles || [])
        .map(file => typeof file === 'string' ? file : file.file || file.path)
        .filter(Boolean),
    };
  }

  async getUserProfile(user = null) {
    return {
      ...(user || demoUser),
      notificationPreferences: {
        critical: true,
        high: true,
        lowConfidence: true,
      },
      integrations: {
        slack: Boolean(config.notifications.defaultWebhooks.slack),
        teams: Boolean(config.notifications.defaultWebhooks.teams),
      },
      connectedRepositories: await this.getRepositories(user),
    };
  }

  async reanalyzeReview(id) {
    const review = await this.getRawReview(id);
    if (!review) {
      const error = new Error('Review not found.');
      error.status = 404;
      throw error;
    }

    const [owner, repo] = String(review.repository || '').split('/');
    const installationId = review.installationId || review.repositoryMetadata?.installationId;
    const pullNumber = review.prNumber;
    const headSha = review.headSha || review.repositoryMetadata?.headSha;

    if (!owner || !repo || !installationId || !pullNumber) {
      const error = new Error('Review does not contain enough GitHub metadata to reanalyze.');
      error.status = 400;
      throw error;
    }

    const job = startReviewJob({
      owner,
      repo,
      pullNumber,
      title: review.title || `PR #${pullNumber}`,
      deliveryId: `manual:${Date.now()}`,
    });

    this.runReanalysis({ job, installationId, owner, repo, pullNumber, headSha }).catch(error => {
      failReviewJob(job.id, error);
      console.error('Manual reanalysis failed:', error);
    });

    return job;
  }

  async runReanalysis({ job, installationId, owner, repo, pullNumber, headSha }) {
    updateReviewJob(job.id, { stage: 'fetching-files', progress: 15 });
    const files = await githubService.getPRFiles(installationId, owner, repo, pullNumber);

    updateReviewJob(job.id, { stage: 'analyzing', progress: 35 });
    const report = await prReviewOrchestratorService.reviewPullRequest({
      installationId,
      owner,
      repo,
      pullNumber,
      ref: headSha,
      changedFiles: files,
      ...buildReviewOptions(),
    });

    updateReviewJob(job.id, { stage: 'persisting', progress: 85 });
    const history = await this.historyService.recordReviewHistory({
      prNumber: pullNumber,
      repository: `${owner}/${repo}`,
      riskScore: report.riskScore ?? report.reviewSummary?.riskScore ?? 0,
      confidence: report.confidence ?? report.reviewSummary?.confidence ?? 0,
      severity: report.severity || report.reviewSummary?.severity || 'LOW',
      summary: report.reviewSummary || null,
      details: buildReviewHistoryDetails({ report, installationId, owner, repo, pullNumber, headSha, files }),
    });

    completeReviewJob(job.id, { reviewHistoryId: history.id || null });
  }

  async loadReviews() {
    if (this.historyService.isConfigured()) {
      const reviews = await this.historyService.listReviews({ limit: 1000 });
      if (reviews.length || !this.demoMode) return reviews;
    }

    return this.demoMode ? demoReviews : [];
  }

  async getRawReview(id) {
    const reviews = await this.loadReviews();
    return reviews.find(item => String(item._id) === String(id)) || null;
  }
}

function normalizeReview(review, { detail = false } = {}) {
  const normalized = {
    id: String(review._id),
    repository: review.repository,
    prNumber: review.prNumber,
    title: review.title || review.summary?.executiveSummary || `PR #${review.prNumber}`,
    prUrl: review.prUrl || `https://github.com/${review.repository}/pull/${review.prNumber}`,
    riskScore: Number(review.riskScore) || 0,
    riskLevel: normalizeSeverity(review.riskLevel || review.severity),
    severity: normalizeSeverity(review.severity),
    confidence: Number(review.confidence) || 0,
    reviewMode: review.reviewMode || 'STANDARD REVIEW',
    affectedSystems: review.affectedSystems || review.summary?.affectedSystems || [],
    architectureImpact: review.architectureImpact || 'NOT_ANALYZED',
    createdAt: new Date(review.createdAt).toISOString(),
  };

  if (!detail) return normalized;

  return {
    ...normalized,
    architectureFindings: review.architectureFindings || [],
    criticalFiles: review.criticalFiles || [],
    suggestedChanges: normalizeSuggestedChanges(
      review.suggestedChanges ||
      review.summary?.suggestedChanges ||
      review.summary?.suggestedNextSteps ||
      []
    ),
    hotspots: review.hotspots || [],
    smartReview: review.smartReview || null,
    dependencyGraph: normalizeGraph(review.dependencyGraph),
    changedFiles: review.changedFiles || [],
    architectureAnalysis: review.architectureAnalysis || null,
    notificationStatus: review.notificationStatus || null,
    githubPublicationStatus: review.githubPublicationStatus || null,
    checkRunStatus: review.checkRunStatus || null,
    readableReport: review.readableReport || review.aiReview?.readableReport || null,
    reviewHistoryId: String(review._id),
    summary: review.summary || null,
  };
}

function buildReviewHistoryDetails({
  report,
  installationId,
  owner,
  repo,
  pullNumber,
  headSha,
  files,
}) {
  const summary = report.reviewSummary || {};

  return {
    title: summary.headline || `PR #${pullNumber}`,
    prUrl: `https://github.com/${owner}/${repo}/pull/${pullNumber}`,
    installationId,
    headSha: headSha || null,
    riskLevel: report.riskLevel || summary.riskLevel || report.severity,
    reviewMode: report.reviewMode || summary.reviewMode || null,
    affectedSystems: report.affectedSystems || summary.affectedSystems || [],
    architectureImpact: report.architectureImpact || 'NOT_ANALYZED',
    architectureFindings: summary.topFindings || [],
    criticalFiles: report.criticalFiles || [],
    suggestedChanges: normalizeSuggestedChanges(
      report.suggestedChanges ||
      summary.suggestedChanges ||
      summary.suggestedNextSteps ||
      []
    ),
    hotspots: report.hotspots || [],
    smartReview: report.smartReview || null,
    dependencyGraph: report.graph || { nodes: [], edges: [] },
    architectureAnalysis: report.architectureAnalysis || null,
    changedFiles: files,
    notificationStatus: report.notificationStatus || null,
    githubPublicationStatus: report.githubPublicationStatus || null,
    checkRunStatus: report.checkRunStatus || null,
    readableReport: report.aiReview?.readableReport || null,
    aiReview: report.aiReview || null,
  };
}

function normalizeSuggestedChanges(suggestions) {
  if (!Array.isArray(suggestions)) return [];

  return suggestions
    .map(suggestion => {
      if (typeof suggestion === 'string') return suggestion;

      const priority = suggestion.priority ? `[${suggestion.priority}] ` : '';
      const title = suggestion.title || 'Review suggested change';
      const files = Array.isArray(suggestion.files) && suggestion.files.length
        ? ` Files: ${suggestion.files.join(', ')}.`
        : '';
      const actions = Array.isArray(suggestion.actions) && suggestion.actions.length
        ? ` Actions: ${suggestion.actions.join(' ')}`
        : '';
      const rationale = suggestion.rationale ? ` ${suggestion.rationale}` : '';

      return `${priority}${title}.${files}${actions}${rationale}`.trim();
    })
    .filter(Boolean);
}

function normalizeGraph(graph = {}) {
  const nodes = graph?.nodes instanceof Map
    ? [...graph.nodes.values()]
    : Array.isArray(graph?.nodes)
      ? graph.nodes
      : [];

  return {
    nodes,
    edges: Array.isArray(graph?.edges) ? graph.edges : [],
  };
}

function groupByDate(reviews, valueSelector, mode = 'average') {
  const groups = new Map();

  for (const review of reviews) {
    const date = review.createdAt.slice(0, 10);
    const values = groups.get(date) || [];
    values.push(Number(valueSelector(review)) || 0);
    groups.set(date, values);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, values]) => ({
      date,
      value: mode === 'sum'
        ? values.reduce((total, value) => total + value, 0)
        : average(values),
    }));
}

function countValues(values) {
  const counts = new Map();
  for (const value of values.filter(Boolean)) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return counts;
}

function topCounts(counts) {
  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 10);
}

function average(values) {
  return values.length
    ? round(values.reduce((total, value) => total + Number(value || 0), 0) / values.length)
    : 0;
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function normalizeSeverity(value) {
  const severity = String(value || 'LOW').toUpperCase();
  return ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(severity) ? severity : 'LOW';
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function endOfDay(date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

export function isValidReviewId(value) {
  return String(value).startsWith('demo-') || ObjectId.isValid(value);
}

export const dashboardService = new DashboardService();
