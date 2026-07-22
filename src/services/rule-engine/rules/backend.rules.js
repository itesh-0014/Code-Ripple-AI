import { createFinding } from '../rule-result.factory.js';
import { RULE_SEVERITY } from '../rule-severity.js';
import {
  containsCall,
  containsReqAccess,
  getCalleePropertyName,
  getFunctionDisplayName,
  getFunctionParams,
  getNodeColumn,
  getNodeLine,
  getPropertyName,
  getRootIdentifierName,
  hasNode,
  walkAst,
} from '../utils/javascript-ast.util.js';
import { isJavaScriptLikeFile } from '../utils/rule-file.util.js';

const mongoQueryMethods = new Set([
  'find',
  'findOne',
  'findById',
  'findByIdAndUpdate',
  'findByIdAndDelete',
  'findOneAndUpdate',
  'findOneAndDelete',
  'updateOne',
  'updateMany',
  'deleteOne',
  'deleteMany',
  'aggregate',
  'countDocuments',
]);

const broadWriteMethods = new Set(['updateMany', 'deleteMany']);

const validationIndicators = [
  /\bz\.object\b/,
  /\bJoi\.object\b/,
  /\byup\.object\b/,
  /\bvalidationResult\s*\(/,
  /\b(req|request)\.(check|assert|validate|sanitize)\b/,
  /\b(schema|validator|validationSchema)\.(parse|safeParse|validate|validateSync)\s*\(/,
  /\b(validate|validateBody|validateRequest|requireFields|sanitizeInput)\s*\(/,
  /\b(body|param|query|check)\s*\(/,
];

export const backendRules = [
  {
    id: 'backend.hardcoded-secret',
    name: 'Hardcoded secret literal',
    category: 'backend',
    severity: RULE_SEVERITY.CRITICAL,
    description:
      'Detects likely credentials, API keys, JWT secrets, and private tokens committed as string literals.',
    recommendation:
      'Move secrets into environment variables or a secret manager, then rotate the exposed credential.',
    appliesTo: file => isJavaScriptLikeFile(file.normalizedPath),
    check: file => {
      const findings = [];
      const secretPattern =
        /\b(api[_-]?key|secret|token|password|passwd|private[_-]?key|client[_-]?secret|jwt[_-]?secret)\b\s*[:=]\s*['"`]([^'"`\s]{8,})['"`]/gi;

      file.lines.forEach((lineText, index) => {
        for (const match of lineText.matchAll(secretPattern)) {
          const keyName = match[1];
          const literal = match[2];

          if (isPlaceholderSecret(literal)) {
            continue;
          }

          findings.push(
            createFinding({
              rule: backendRules[0],
              file,
              line: index + 1,
              column: match.index || 0,
              message: `Possible hardcoded secret assigned to "${keyName}".`,
              evidence: [`${keyName}=<redacted>`],
              confidence: 'medium',
              metadata: {
                keyName,
              },
            })
          );
        }
      });

      return findings.slice(0, 20);
    },
  },
  {
    id: 'backend.missing-try-catch',
    name: 'Async backend handler missing try/catch',
    category: 'backend',
    severity: RULE_SEVERITY.MEDIUM,
    description:
      'Flags async Express handlers/controllers that await work without a local try/catch.',
    recommendation:
      'Wrap awaited controller logic in try/catch or use a centralized asyncHandler wrapper.',
    appliesTo: file =>
      file.scope === 'changed' &&
      file.isBackend &&
      isJavaScriptLikeFile(file.normalizedPath) &&
      file.ast,
    check: file => {
      const findings = [];

      walkAst(file.ast, (node, parent) => {
        if (!isFunctionNode(node) || !node.async || !isHttpHandlerLike(node, file)) {
          return;
        }

        const hasAwait = hasNode(node.body, child => child.type === 'AwaitExpression');
        const hasTryCatch = hasNode(node.body, child => child.type === 'TryStatement');

        if (!hasAwait || hasTryCatch || isWrappedByAsyncHandler(parent)) {
          return;
        }

        findings.push(
          createFinding({
            rule: backendRules[1],
            file,
            line: getNodeLine(node),
            column: getNodeColumn(node),
            severity: file.layer === 'api' ? RULE_SEVERITY.HIGH : RULE_SEVERITY.MEDIUM,
            message: `Async backend handler "${getFunctionDisplayName(
              node,
              parent
            )}" awaits work without local error handling.`,
            evidence: ['async function', 'await expression', 'no try/catch'],
            confidence: 'medium',
          })
        );
      });

      return findings;
    },
  },
  {
    id: 'backend.unsafe-mongo-query',
    name: 'Unsafe Mongo query input',
    category: 'backend',
    severity: RULE_SEVERITY.HIGH,
    description:
      'Detects Mongo/Mongoose calls that use raw request data or broad write filters.',
    recommendation:
      'Whitelist query fields, validate identifiers, and avoid broad update/delete filters.',
    appliesTo: file => file.isBackend && isJavaScriptLikeFile(file.normalizedPath) && file.ast,
    check: file => {
      const findings = [];

      walkAst(file.ast, node => {
        if (node.type !== 'CallExpression') {
          return;
        }

        const methodName = getCalleePropertyName(node);

        if (!mongoQueryMethods.has(methodName)) {
          return;
        }

        const firstArg = node.arguments?.[0];
        const usesRawRequestInput = node.arguments?.some(arg => containsReqAccess(arg));
        const hasBroadWriteFilter =
          broadWriteMethods.has(methodName) &&
          (!firstArg || isEmptyObjectExpression(firstArg));
        const hasWhereOperator = node.arguments?.some(arg => containsMongoWhereOperator(arg));

        if (!usesRawRequestInput && !hasBroadWriteFilter && !hasWhereOperator) {
          return;
        }

        const severity =
          hasBroadWriteFilter || hasWhereOperator
            ? RULE_SEVERITY.CRITICAL
            : RULE_SEVERITY.HIGH;

        findings.push(
          createFinding({
            rule: backendRules[2],
            file,
            line: getNodeLine(node),
            column: getNodeColumn(node),
            severity,
            message: `Potentially unsafe Mongo query via "${methodName}".`,
            evidence: buildMongoEvidence({
              usesRawRequestInput,
              hasBroadWriteFilter,
              hasWhereOperator,
            }),
            confidence: 'medium',
            metadata: {
              methodName,
            },
          })
        );
      });

      return findings;
    },
  },
  {
    id: 'backend.missing-request-validation',
    name: 'Missing request validation',
    category: 'backend',
    severity: RULE_SEVERITY.HIGH,
    description:
      'Flags changed route/controller files that read request input without visible validation.',
    recommendation:
      'Validate req.body, req.params, and req.query with a schema before business logic or DB calls.',
    appliesTo: file =>
      file.scope === 'changed' &&
      file.isBackend &&
      isJavaScriptLikeFile(file.normalizedPath) &&
      file.ast,
    check: file => {
      if (!isRouteOrController(file.normalizedPath) || hasValidationIndicator(file.content)) {
        return [];
      }

      const findings = [];

      walkAst(file.ast, node => {
        if (!isRequestInputAccess(node)) {
          return;
        }

        findings.push(
          createFinding({
            rule: backendRules[3],
            file,
            line: getNodeLine(node),
            column: getNodeColumn(node),
            message: 'Request input is used without an obvious validation step.',
            evidence: ['req.body/req.params/req.query access'],
            confidence: 'medium',
          })
        );
      });

      return dedupeByLine(findings).slice(0, 10);
    },
  },
  {
    id: 'backend.direct-db-access',
    name: 'Direct DB access from route/controller',
    category: 'backend',
    severity: RULE_SEVERITY.MEDIUM,
    description:
      'Detects data-layer calls in routes/controllers where a service/repository boundary would be safer.',
    recommendation:
      'Move database access into a service or repository layer and keep controllers focused on HTTP concerns.',
    appliesTo: file =>
      file.isBackend &&
      isRouteOrController(file.normalizedPath) &&
      isJavaScriptLikeFile(file.normalizedPath) &&
      file.ast,
    check: file => {
      const findings = [];

      walkAst(file.ast, node => {
        if (node.type !== 'CallExpression') {
          return;
        }

        const methodName = getCalleePropertyName(node);

        if (!mongoQueryMethods.has(methodName)) {
          return;
        }

        findings.push(
          createFinding({
            rule: backendRules[4],
            file,
            line: getNodeLine(node),
            column: getNodeColumn(node),
            message: `Controller/route performs "${methodName}" directly.`,
            evidence: ['database method called in HTTP layer'],
            confidence: 'medium',
            metadata: {
              methodName,
            },
          })
        );
      });

      return findings.slice(0, 12);
    },
  },
];

function isPlaceholderSecret(value) {
  return /^(example|sample|test|dummy|change-me|changeme|replace-me|your-|xxxx|<|\$\{)/i.test(
    value
  );
}

function isFunctionNode(node) {
  return [
    'FunctionDeclaration',
    'FunctionExpression',
    'ArrowFunctionExpression',
    'ObjectMethod',
    'ClassMethod',
  ].includes(node.type);
}

function isHttpHandlerLike(node, file) {
  const params = getFunctionParams(node);

  return (
    params.includes('req') ||
    params.includes('res') ||
    params.includes('request') ||
    params.includes('response') ||
    isRouteOrController(file.normalizedPath)
  );
}

function isWrappedByAsyncHandler(parent) {
  if (parent?.type !== 'CallExpression') {
    return false;
  }

  const calleeName =
    parent.callee?.type === 'Identifier' ? parent.callee.name : getCalleePropertyName(parent);

  return /^(asyncHandler|catchAsync|wrapAsync|tryCatch)$/.test(calleeName || '');
}

function isRouteOrController(filePath) {
  return /(^|\/)(routes?|controllers?)(\/|\.|-|_)/i.test(filePath);
}

function isEmptyObjectExpression(node) {
  return node?.type === 'ObjectExpression' && node.properties.length === 0;
}

function containsMongoWhereOperator(node) {
  return hasNode(node, child => {
    if (child.type !== 'ObjectProperty' && child.type !== 'ObjectMethod') {
      return false;
    }

    return getPropertyName(child.key) === '$where';
  });
}

function buildMongoEvidence({
  usesRawRequestInput,
  hasBroadWriteFilter,
  hasWhereOperator,
}) {
  return [
    usesRawRequestInput ? 'raw request input reaches query arguments' : null,
    hasBroadWriteFilter ? 'broad update/delete filter' : null,
    hasWhereOperator ? '$where operator detected' : null,
  ].filter(Boolean);
}

function hasValidationIndicator(content) {
  return validationIndicators.some(pattern => pattern.test(content));
}

function isRequestInputAccess(node) {
  if (node.type !== 'MemberExpression') {
    return false;
  }

  const rootName = getRootIdentifierName(node);
  const propertyName = getPropertyName(node.property);

  return rootName === 'req' && ['body', 'params', 'query'].includes(propertyName);
}

function dedupeByLine(findings) {
  const seen = new Set();

  return findings.filter(finding => {
    const key = `${finding.filePath}:${finding.line}:${finding.ruleId}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
