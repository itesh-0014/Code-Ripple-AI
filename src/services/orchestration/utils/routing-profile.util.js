import {
  classifyModuleLayer,
  normalizeRepoPath,
} from '../../../utils/repository-path.util.js';

const backendLayers = new Set([
  'auth-security',
  'api',
  'data',
  'business-logic',
]);

const frontendPathPattern =
  /(^|\/)(client|frontend|web|components?|pages?|screens?|views?|hooks?)(\/|$)/i;

const backendPathPattern =
  /(^|\/)(server|backend|api|routes?|controllers?|services?|middlewares?|models?|repositories?|db|database)(\/|$)/i;

const authSensitivePattern =
  /(auth|jwt|session|token|middleware|permission|role|roles|oauth|passport)/i;

export function buildRoutingProfile({ impact, scanResult }) {
  const fileByPath = new Map(
    (scanResult?.files || []).map(file => [
      normalizeRepoPath(file.path),
      file,
    ])
  );

  const changedSourceFiles = (impact?.changedFiles || [])
    .filter(file => file.isSourceFile)
    .map(file => buildChangedFileRouteContext({ file, fileByPath }));

  const hasSourceChanges = changedSourceFiles.length > 0;
  const hasFrontendChange = changedSourceFiles.some(file => file.isFrontend);
  const hasBackendChange = changedSourceFiles.some(file => file.isBackend);
  const hasAuthSensitiveChange = changedSourceFiles.some(file => file.isAuthSensitive);
  const affectedLayers = new Set(impact?.summary?.affectedLayers || []);
  const affectedBackend = [...affectedLayers].some(layer => backendLayers.has(layer));
  const affectedFrontend = affectedLayers.has('frontend-ui');
  const frontendOnly =
    hasSourceChanges &&
    hasFrontendChange &&
    !hasBackendChange &&
    !hasAuthSensitiveChange &&
    !affectedBackend;
  const backendOnly =
    hasSourceChanges &&
    hasBackendChange &&
    !hasFrontendChange &&
    !affectedFrontend;
  const broadImpact =
    (impact?.summary?.affectedModuleCount || 0) >= 10 ||
    (impact?.summary?.affectedLayers || []).length >= 3;

  const excludedRuleCategories = [];

  if (frontendOnly) {
    excludedRuleCategories.push('backend');
  }

  if (backendOnly) {
    excludedRuleCategories.push('frontend');
  }

  return {
    reviewMode: hasAuthSensitiveChange
      ? 'security-focused'
      : frontendOnly
        ? 'frontend-focused'
        : backendOnly
          ? 'backend-focused'
          : broadImpact
            ? 'architecture-impact-focused'
            : 'standard',
    conditions: {
      frontendOnly,
      backendOnly,
      authenticationFilesChanged: hasAuthSensitiveChange,
      broadImpact,
      affectedBackend,
      affectedFrontend,
    },
    rulePolicy: {
      excludedRuleCategories,
      reason: buildRulePolicyReason({
        frontendOnly,
        backendOnly,
        hasAuthSensitiveChange,
      }),
    },
    changedSourceFiles,
  };
}

export function applyRoutingRiskSignals({ impact, routeProfile }) {
  if (!routeProfile?.conditions?.authenticationFilesChanged) {
    return impact;
  }

  const existingSignals = impact?.riskSignals || [];
  const hasSecuritySignal = existingSignals.some(
    signal => signal.type === 'security-sensitive-change'
  );

  if (hasSecuritySignal) {
    return impact;
  }

  return {
    ...impact,
    riskSignals: [
      ...existingSignals,
      {
        type: 'security-sensitive-change',
        level: 'high',
        message:
          'Authentication, authorization, session, token, permission, or middleware code changed. Run a security-focused review path.',
        evidence: routeProfile.changedSourceFiles
          .filter(file => file.isAuthSensitive)
          .map(file => file.path),
      },
    ],
  };
}

function buildChangedFileRouteContext({ file, fileByPath }) {
  const normalizedPath = normalizeRepoPath(file.filename);
  const sourceFile = fileByPath.get(normalizedPath);
  const content = sourceFile?.content || '';
  const layer = file.layer || classifyModuleLayer(normalizedPath);

  return {
    path: normalizedPath,
    layer,
    isFrontend: isFrontendPath(normalizedPath, content),
    isBackend: isBackendPath(normalizedPath, content, layer),
    isAuthSensitive:
      layer === 'auth-security' || authSensitivePattern.test(normalizedPath),
  };
}

function isFrontendPath(filePath, content) {
  return (
    frontendPathPattern.test(filePath) ||
    /\.(jsx|tsx)$/i.test(filePath) ||
    /\b(React|useEffect|useState|useMemo|useCallback)\b/.test(content)
  );
}

function isBackendPath(filePath, content, layer) {
  return (
    backendLayers.has(layer) ||
    backendPathPattern.test(filePath) ||
    /\b(express|mongoose|router\.|app\.|req\.|res\.)\b/.test(content)
  );
}

function buildRulePolicyReason({
  frontendOnly,
  backendOnly,
  hasAuthSensitiveChange,
}) {
  if (hasAuthSensitiveChange) {
    return 'Authentication-sensitive files changed; keep backend and security-oriented validation enabled.';
  }

  if (frontendOnly) {
    return 'Frontend-only PR detected; backend-specific rule category is skipped to reduce false positives.';
  }

  if (backendOnly) {
    return 'Backend-only PR detected; frontend-specific rule category is skipped to reduce noise.';
  }

  return 'Mixed or architecture-impacting PR; all rule categories remain enabled.';
}
