import {
  classifyModuleLayer,
  getRepoExtension,
  isSourceFile,
  normalizeRepoPath,
} from '../../../utils/repository-path.util.js';
import { normalizeSeverity, SEVERITY_RANK } from '../utils/severity.util.js';

export const REVIEW_DEPTH = Object.freeze({
  LIGHT: 'LIGHT',
  STANDARD: 'STANDARD',
  DEEP: 'DEEP',
});

export const RISK_LEVEL = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

export const CONTEXT_RETRIEVAL_MODE = Object.freeze({
  NORMAL: 'NORMAL',
  EXPANDED: 'EXPANDED',
});

export const ROUTING_THRESHOLDS = Object.freeze({
  mediumRiskScore: 45,
  highRiskScore: 70,
  criticalRiskScore: 90,
  minReviewConfidence: 65,
  maxContextExpansionRetries: 2,
  normalContextChunksPerChangedFile: 5,
  expandedContextChunksPerChangedFile: 15,
});

const styleExtensions = new Set(['.css', '.scss', '.sass', '.less']);
const frontendExtensions = new Set(['.jsx', '.tsx']);
const dataLayerPattern = /(^|\/)(models?|schemas?|db|database|migrations?)(\/|\.|-|_)/i;
const authSensitivePattern =
  /(auth|jwt|session|token|middleware|permission|role|roles|oauth|passport)/i;
const frontendPathPattern =
  /(^|\/)(client|frontend|web|components?|pages?|screens?|views?|hooks?)(\/|$)/i;
const backendPathPattern =
  /(^|\/)(server|backend|api|routes?|controllers?|services?|middlewares?|models?|repositories?|db|database)(\/|$)/i;

export function analyzeChangedFilesForPlanning(changedFiles = []) {
  const normalizedFiles = changedFiles.map(file => {
    const filename = normalizeRepoPath(file.filename || '');
    const extension = getRepoExtension(filename);
    const layer = classifyModuleLayer(filename);
    const source = isSourceFile(filename);
    const additions = Number(file.additions || 0);
    const deletions = Number(file.deletions || 0);
    const changes = Number(file.changes || additions + deletions || 0);

    return {
      filename,
      status: file.status || 'modified',
      extension,
      layer,
      isSourceFile: source,
      isStyleFile: styleExtensions.has(extension),
      isFrontend:
        frontendExtensions.has(extension) || frontendPathPattern.test(filename),
      isBackend: backendPathPattern.test(filename) || isBackendLayer(layer),
      isDataLayer: layer === 'data' || dataLayerPattern.test(filename),
      isAuthSensitive:
        layer === 'auth-security' || authSensitivePattern.test(filename),
      additions,
      deletions,
      changes,
    };
  });

  const sourceFiles = normalizedFiles.filter(file => file.isSourceFile);
  const changedLayers = [...new Set(normalizedFiles.map(file => file.layer))].sort();
  const changedExtensions = [
    ...new Set(normalizedFiles.map(file => file.extension).filter(Boolean)),
  ].sort();
  const totalAdditions = normalizedFiles.reduce(
    (total, file) => total + file.additions,
    0
  );
  const totalDeletions = normalizedFiles.reduce(
    (total, file) => total + file.deletions,
    0
  );
  const totalChanges = normalizedFiles.reduce(
    (total, file) => total + file.changes,
    0
  );
  const frontendFileCount = normalizedFiles.filter(file => file.isFrontend).length;
  const backendFileCount = normalizedFiles.filter(file => file.isBackend).length;
  const authSensitiveFileCount = normalizedFiles.filter(
    file => file.isAuthSensitive
  ).length;
  const dataLayerFileCount = normalizedFiles.filter(file => file.isDataLayer).length;
  const styleFileCount = normalizedFiles.filter(file => file.isStyleFile).length;

  return {
    files: normalizedFiles,
    totalFiles: normalizedFiles.length,
    sourceFileCount: sourceFiles.length,
    totalAdditions,
    totalDeletions,
    totalChanges,
    changedLayers,
    changedExtensions,
    frontendFileCount,
    backendFileCount,
    authSensitiveFileCount,
    dataLayerFileCount,
    styleFileCount,
    frontendOnly:
      normalizedFiles.length > 0 &&
      frontendFileCount > 0 &&
      backendFileCount === 0 &&
      authSensitiveFileCount === 0 &&
      dataLayerFileCount === 0,
    styleOnly:
      normalizedFiles.length > 0 && styleFileCount === normalizedFiles.length,
    backendTouched: backendFileCount > 0,
    authTouched: authSensitiveFileCount > 0,
    dataTouched: dataLayerFileCount > 0,
    nonSourceOnly: normalizedFiles.length > 0 && sourceFiles.length === 0,
  };
}

export function calculatePlannerRiskScore(analysis) {
  let score = analysis.sourceFileCount > 0 ? 22 : 12;

  if (analysis.totalFiles >= 12) {
    score += 18;
  } else if (analysis.totalFiles >= 6) {
    score += 10;
  } else if (analysis.totalFiles >= 3) {
    score += 4;
  }

  if (analysis.totalChanges >= 1000) {
    score += 22;
  } else if (analysis.totalChanges >= 500) {
    score += 14;
  } else if (analysis.totalChanges >= 180) {
    score += 7;
  }

  if (analysis.authTouched) {
    score += 34;
  }

  if (analysis.dataTouched) {
    score += 24;
  }

  if (analysis.backendTouched) {
    score += 12;
  }

  if (analysis.changedLayers.includes('shared-utility')) {
    score += 9;
  }

  if (analysis.changedLayers.includes('configuration')) {
    score += 7;
  }

  if (analysis.changedLayers.length >= 3) {
    score += 10;
  }

  if (analysis.frontendOnly) {
    score -= 7;
  }

  if (analysis.styleOnly || analysis.nonSourceOnly) {
    score -= 8;
  }

  return clampRiskScore(score);
}

export function chooseReviewDepth({ analysis, riskScore }) {
  if (
    analysis.authTouched ||
    analysis.dataTouched ||
    riskScore >= ROUTING_THRESHOLDS.highRiskScore
  ) {
    return REVIEW_DEPTH.DEEP;
  }

  if (
    analysis.frontendOnly &&
    (analysis.styleOnly || analysis.totalChanges <= 250) &&
    riskScore < ROUTING_THRESHOLDS.mediumRiskScore
  ) {
    return REVIEW_DEPTH.LIGHT;
  }

  return REVIEW_DEPTH.STANDARD;
}

export function riskLevelFromScore(score) {
  if (score >= ROUTING_THRESHOLDS.criticalRiskScore) {
    return RISK_LEVEL.CRITICAL;
  }

  if (score >= ROUTING_THRESHOLDS.highRiskScore) {
    return RISK_LEVEL.HIGH;
  }

  if (score >= ROUTING_THRESHOLDS.mediumRiskScore) {
    return RISK_LEVEL.MEDIUM;
  }

  return RISK_LEVEL.LOW;
}

export function calculateAdaptiveRiskScore({
  baseRiskScore = 0,
  impact,
  routeProfile,
  validation,
  aiReview,
  architectureAnalysis,
}) {
  let score = Number.isFinite(baseRiskScore) ? baseRiskScore : 0;
  const affectedModuleCount = impact?.summary?.affectedModuleCount || 0;
  const affectedLayerCount = impact?.summary?.affectedLayers?.length || 0;
  const maxPropagationDepth = impact?.summary?.maxPropagationDepth || 0;

  if (affectedModuleCount >= 20) {
    score += 22;
  } else if (affectedModuleCount >= 10) {
    score += 15;
  } else if (affectedModuleCount >= 4) {
    score += 7;
  }

  if (affectedLayerCount >= 3) {
    score += 10;
  }

  if (maxPropagationDepth >= 3) {
    score += 8;
  }

  if (routeProfile?.conditions?.authenticationFilesChanged) {
    score += 15;
  }

  if (routeProfile?.conditions?.broadImpact) {
    score += 14;
  }

  score += scoreRiskSignals(impact?.riskSignals || []);
  score += scoreSeverity(validation?.summary?.highestSeverity, {
    CRITICAL: 24,
    HIGH: 17,
    MEDIUM: 8,
    LOW: 2,
  });
  score += scoreSeverity(aiReview?.riskLevel, {
    CRITICAL: 24,
    HIGH: 16,
    MEDIUM: 7,
    LOW: 0,
  });
  score += scoreSeverity(architectureAnalysis?.architecturalRisk, {
    CRITICAL: 24,
    HIGH: 16,
    MEDIUM: 8,
    LOW: 0,
  });

  return clampRiskScore(score);
}

export function getCurrentConfidence(state) {
  const confidence = Number.parseInt(
    state.aiReview?.confidence ?? state.confidence,
    10
  );

  return Number.isFinite(confidence) ? confidence : null;
}

export function shouldRequestContextExpansion(state) {
  if (!state.options?.includeSemanticContext) {
    return false;
  }

  if (state.options?.includeAiReview === false) {
    return false;
  }

  const confidence = getCurrentConfidence(state);

  if (
    confidence === null ||
    confidence >= ROUTING_THRESHOLDS.minReviewConfidence
  ) {
    return false;
  }

  return (
    (state.retries?.contextExpansion || 0) <
    ROUTING_THRESHOLDS.maxContextExpansionRetries
  );
}

export function shouldRunArchitectureAnalysis(state) {
  if (state.architectureAnalysis) {
    return false;
  }

  const requiredAgents = new Set(state.executionPlan?.requiredAgents || []);

  if (requiredAgents.has('architectureAgent')) {
    return true;
  }

  if ((state.riskScore || 0) >= ROUTING_THRESHOLDS.highRiskScore) {
    return true;
  }

  if (
    state.routeProfile?.conditions?.authenticationFilesChanged ||
    state.routeProfile?.conditions?.broadImpact
  ) {
    return true;
  }

  if ((state.impact?.riskSignals || []).some(signal => isHighRisk(signal.level))) {
    return true;
  }

  return isHighRisk(state.aiReview?.riskLevel);
}

export function getContextRetrievalLimit(mode) {
  return mode === CONTEXT_RETRIEVAL_MODE.EXPANDED
    ? ROUTING_THRESHOLDS.expandedContextChunksPerChangedFile
    : ROUTING_THRESHOLDS.normalContextChunksPerChangedFile;
}

export function clampRiskScore(score) {
  return Math.min(100, Math.max(0, Math.round(score)));
}

function scoreRiskSignals(riskSignals) {
  return Math.min(
    30,
    riskSignals.reduce((total, signal) => {
      if (normalizeSeverity(signal.level) === 'CRITICAL') {
        return total + 18;
      }

      if (normalizeSeverity(signal.level) === 'HIGH') {
        return total + 12;
      }

      if (normalizeSeverity(signal.level) === 'MEDIUM') {
        return total + 6;
      }

      return total + 1;
    }, 0)
  );
}

function scoreSeverity(value, scoreMap) {
  const severity = normalizeSeverity(value);

  return scoreMap[severity] || 0;
}

function isHighRisk(value) {
  return SEVERITY_RANK[normalizeSeverity(value)] >= SEVERITY_RANK.HIGH;
}

function isBackendLayer(layer) {
  return ['auth-security', 'api', 'data', 'business-logic'].includes(layer);
}
