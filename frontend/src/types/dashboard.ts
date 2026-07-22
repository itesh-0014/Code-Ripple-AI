export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Review {
  id: string;
  repository: string;
  prNumber: number;
  title: string;
  prUrl: string;
  riskScore: number;
  riskLevel: Severity;
  severity: Severity;
  confidence: number;
  reviewMode: string;
  affectedSystems: string[];
  architectureImpact: string;
  createdAt: string;
}

export interface Finding {
  severity: Severity;
  title: string;
  description: string;
  filePath?: string;
}

export interface CriticalFile {
  file: string;
  score?: number;
  criticality?: string;
}

export interface GraphNode {
  path: string;
  layer?: string;
  dependencies?: string[];
  dependents?: string[];
}

export interface GraphEdge {
  from: string;
  to: string;
  kind?: string;
}

export interface ReviewDetail extends Review {
  architectureFindings: Finding[];
  criticalFiles: Array<CriticalFile | string>;
  suggestedChanges: string[];
  hotspots: Array<{ file: string; score: number; reasons?: string[] }>;
  smartReview: { prSize?: string; reviewMode?: string } | null;
  dependencyGraph: { nodes: GraphNode[]; edges: GraphEdge[] };
  changedFiles: Array<{ filename: string }>;
  notificationStatus?: string | null;
  githubPublicationStatus?: string | null;
  checkRunStatus?: string | null;
  readableReport?: string | null;
  reviewHistoryId?: string;
}

export interface Repository {
  id: string;
  name: string;
  connected: boolean;
  appInstalled?: boolean;
  private?: boolean;
  reviewCount: number;
  averageRisk: number;
  criticalReviews: number;
  lastReviewAt: string;
  htmlUrl?: string;
}

export interface ReviewJob {
  id: string;
  repository: string;
  pullNumber: number;
  title?: string;
  status: 'running' | 'completed' | 'failed';
  stage: string;
  progress: number;
  startedAt: string;
  updatedAt: string;
  completedAt?: string | null;
  reviewHistoryId?: string | null;
  error?: { message: string; code: string } | null;
}

export interface WebhookDelivery {
  _id?: string;
  deliveryId?: string | null;
  event: string;
  action?: string | null;
  repository?: string | null;
  status: string;
  message?: string | null;
  createdAt: string;
}

export interface ReviewSettings {
  mode: string;
  includeAiReview: boolean;
  includeSemanticContext?: boolean;
  geminiRetries: number;
  geminiTimeoutMs: number;
}

export interface Analytics {
  totals: {
    repositories: number;
    reviews: number;
    criticalReviews: number;
    averageRisk: number;
    averageConfidence: number;
  };
  riskTrend: TrendPoint[];
  confidenceTrend: TrendPoint[];
  reviewVolume: TrendPoint[];
  riskDistribution: Array<{ name: Severity; value: number }>;
  recentReviews: Review[];
}

export interface TrendPoint {
  date: string;
  value: number;
}

export interface ArchitectureInsights {
  impactedSystems: Array<{ name: string; value: number }>;
  riskyModules: Array<{ name: string; reviews: number; averageRisk: number }>;
  frequentlyModified: Array<{ name: string; reviews: number; averageRisk: number }>;
  hotspots: Array<{ file: string; score: number; reasons?: string[] }>;
}

export interface DependencyResponse {
  repository: string | null;
  reviewId: string | null;
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  impactedFiles: string[];
}

export interface UserProfile {
  id: string;
  login: string;
  name: string;
  avatarUrl: string;
  email?: string;
  plan: string;
  demo?: boolean;
  notificationPreferences: Record<string, boolean>;
  integrations: { slack: boolean; teams: boolean };
  connectedRepositories: Repository[];
}

export interface PaginatedReviews {
  items: Review[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
