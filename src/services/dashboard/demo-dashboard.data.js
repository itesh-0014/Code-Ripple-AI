const now = Date.now();
const day = 24 * 60 * 60 * 1000;

export const demoReviews = [
  review({
    id: 'demo-1',
    repository: 'acme/backend-api',
    prNumber: 142,
    title: 'Harden JWT rotation and protected route validation',
    riskScore: 8.9,
    confidence: 92,
    severity: 'CRITICAL',
    daysAgo: 1,
    affectedSystems: ['Authentication', 'Protected APIs', 'Session Validation'],
    files: ['src/auth/jwt.middleware.js', 'src/routes/protected.routes.js'],
  }),
  review({
    id: 'demo-2',
    repository: 'acme/commerce-web',
    prNumber: 318,
    title: 'Refactor checkout state and payment confirmation',
    riskScore: 7.2,
    confidence: 86,
    severity: 'HIGH',
    daysAgo: 3,
    affectedSystems: ['Checkout', 'Payments', 'Frontend State'],
    files: ['src/features/checkout/store.ts', 'src/pages/Confirmation.tsx'],
  }),
  review({
    id: 'demo-3',
    repository: 'acme/backend-api',
    prNumber: 139,
    title: 'Add customer export query indexes',
    riskScore: 5.4,
    confidence: 89,
    severity: 'MEDIUM',
    daysAgo: 6,
    affectedSystems: ['Database', 'Reporting API'],
    files: ['src/database/customer.model.js', 'src/services/export.service.js'],
  }),
  review({
    id: 'demo-4',
    repository: 'acme/design-system',
    prNumber: 87,
    title: 'Introduce accessible command palette primitives',
    riskScore: 2.8,
    confidence: 95,
    severity: 'LOW',
    daysAgo: 9,
    affectedSystems: ['Component Library', 'Accessibility'],
    files: ['src/components/CommandPalette.tsx'],
  }),
  review({
    id: 'demo-5',
    repository: 'acme/commerce-web',
    prNumber: 311,
    title: 'Unify session hydration across storefront routes',
    riskScore: 6.8,
    confidence: 78,
    severity: 'HIGH',
    daysAgo: 13,
    affectedSystems: ['Authentication', 'Frontend State', 'API Layer'],
    files: ['src/auth/session.ts', 'src/router/loaders.ts'],
  }),
  review({
    id: 'demo-6',
    repository: 'acme/data-pipeline',
    prNumber: 64,
    title: 'Batch event reconciliation for delayed webhooks',
    riskScore: 4.7,
    confidence: 84,
    severity: 'MEDIUM',
    daysAgo: 18,
    affectedSystems: ['Event Processing', 'Database', 'Webhooks'],
    files: ['src/workers/reconcile.ts', 'src/database/events.ts'],
  }),
  review({
    id: 'demo-7',
    repository: 'acme/backend-api',
    prNumber: 128,
    title: 'Move permission checks into policy middleware',
    riskScore: 8.1,
    confidence: 90,
    severity: 'CRITICAL',
    daysAgo: 24,
    affectedSystems: ['Authorization', 'Middleware', 'Protected APIs'],
    files: ['src/auth/policy.middleware.js', 'src/routes/admin.routes.js'],
  }),
  review({
    id: 'demo-8',
    repository: 'acme/design-system',
    prNumber: 79,
    title: 'Reduce dashboard chart bundle size',
    riskScore: 2.1,
    confidence: 97,
    severity: 'LOW',
    daysAgo: 31,
    affectedSystems: ['Build System', 'Charts'],
    files: ['src/charts/index.ts'],
  }),
];

export const demoUser = {
  id: 'demo-user',
  login: 'Itesh-Kumar',
  name: 'Itesh Kumar',
  avatarUrl: 'https://github.com/identicons/gitripple-demo.png',
  email: 'developer@example.com',
  plan: 'Team',
  demo: true,
};

function review({
  id,
  repository,
  prNumber,
  title,
  riskScore,
  confidence,
  severity,
  daysAgo,
  affectedSystems,
  files,
}) {
  const nodes = files.map((path, index) => ({
    path,
    layer: path.includes('auth')
      ? 'auth-security'
      : path.includes('database')
        ? 'data'
        : path.includes('components') || path.endsWith('.tsx')
          ? 'frontend-ui'
          : 'service',
    dependencies: index < files.length - 1 ? [files[index + 1]] : [],
    dependents: index > 0 ? [files[index - 1]] : [],
  }));

  return {
    _id: id,
    repository,
    prNumber,
    title,
    prUrl: `https://github.com/${repository}/pull/${prNumber}`,
    riskScore,
    riskLevel: severity,
    confidence,
    severity,
    reviewMode: riskScore >= 7 ? 'RISK-FIRST REVIEW' : 'FULL REVIEW',
    affectedSystems,
    architectureImpact: riskScore >= 7 ? 'HIGH' : riskScore >= 4 ? 'MEDIUM' : 'LOW',
    architectureFindings: [
      {
        severity,
        title: `${affectedSystems[0]} change requires focused review`,
        description: `The PR changes behavior across ${affectedSystems.join(', ')}.`,
        filePath: files[0],
      },
    ],
    criticalFiles: files.map((file, index) => ({
      file,
      score: Math.max(45, Math.round(riskScore * 10) - index * 8),
      criticality: index === 0 && riskScore >= 7 ? 'CRITICAL' : 'HIGH',
    })),
    suggestedChanges: [
      'Run focused regression tests for impacted systems.',
      'Confirm monitoring and rollback coverage before merge.',
    ],
    hotspots: files.slice(0, 2).map(file => ({
      file,
      score: Math.round(riskScore * 10),
      reasons: ['Frequently modified', 'Broad dependency impact'],
    })),
    smartReview: {
      prSize: files.length > 3 ? 'LARGE' : 'SMALL',
      reviewMode: riskScore >= 7 ? 'RISK-FIRST REVIEW' : 'FULL REVIEW',
    },
    dependencyGraph: {
      nodes,
      edges: nodes.flatMap(node =>
        node.dependencies.map(dependency => ({
          from: node.path,
          to: dependency,
          kind: 'import',
        }))
      ),
    },
    changedFiles: files.map(filename => ({ filename })),
    summary: {
      executiveSummary: title,
      affectedSystems,
      riskScore,
      confidence,
      severity,
    },
    createdAt: new Date(now - daysAgo * day),
  };
}
