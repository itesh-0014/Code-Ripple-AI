import { createFinding } from '../rule-result.factory.js';
import { RULE_SEVERITY } from '../rule-severity.js';
import {
  containsCall,
  getCalleePropertyName,
  getNodeColumn,
  getNodeLine,
  getPropertyName,
  getRootIdentifierName,
  hasNode,
  isUseEffectCall,
  isUseStateCall,
  walkAst,
} from '../utils/javascript-ast.util.js';
import { isJavaScriptLikeFile } from '../utils/rule-file.util.js';

const mutatingArrayMethods = new Set([
  'copyWithin',
  'fill',
  'pop',
  'push',
  'reverse',
  'shift',
  'sort',
  'splice',
  'unshift',
]);

export const frontendRules = [
  {
    id: 'frontend.use-effect-missing-deps',
    name: 'useEffect missing dependency array',
    category: 'frontend',
    severity: RULE_SEVERITY.MEDIUM,
    description:
      'Detects React useEffect calls without a dependency array, which can re-run after every render.',
    recommendation:
      'Add a dependency array or refactor the effect so repeated execution is intentional and safe.',
    appliesTo: file =>
      file.scope === 'changed' &&
      file.isFrontend &&
      isJavaScriptLikeFile(file.normalizedPath) &&
      file.ast,
    check: file => {
      const stateSetters = collectStateSetters(file.ast);
      const findings = [];

      walkAst(file.ast, node => {
        if (!isUseEffectCall(node) || node.arguments.length >= 2) {
          return;
        }

        const callback = node.arguments[0];
        const updatesState = callback
          ? containsCall(callback, call => stateSetters.has(getRootIdentifierName(call.callee)))
          : false;

        findings.push(
          createFinding({
            rule: frontendRules[0],
            file,
            line: getNodeLine(node),
            column: getNodeColumn(node),
            severity: updatesState ? RULE_SEVERITY.HIGH : RULE_SEVERITY.MEDIUM,
            message: 'useEffect is missing a dependency array.',
            evidence: updatesState
              ? ['effect runs each render', 'state setter inside effect']
              : ['effect runs each render'],
            confidence: 'high',
          })
        );
      });

      return findings;
    },
  },
  {
    id: 'frontend.direct-state-mutation',
    name: 'Direct React state mutation',
    category: 'frontend',
    severity: RULE_SEVERITY.HIGH,
    description:
      'Detects mutation of values returned by useState instead of immutable updates through the setter.',
    recommendation:
      'Create a new object/array and update state through the setter function.',
    appliesTo: file =>
      file.isFrontend && isJavaScriptLikeFile(file.normalizedPath) && file.ast,
    check: file => {
      const stateVars = collectStateVariables(file.ast);
      const findings = [];

      if (stateVars.size === 0) {
        return findings;
      }

      walkAst(file.ast, node => {
        if (node.type === 'AssignmentExpression') {
          const rootName = getRootIdentifierName(node.left);

          if (stateVars.has(rootName)) {
            findings.push(
              buildStateMutationFinding({
                rule: frontendRules[1],
                file,
                node,
                stateName: rootName,
                evidence: ['assignment to state value'],
              })
            );
          }
        }

        if (node.type === 'UpdateExpression') {
          const rootName = getRootIdentifierName(node.argument);

          if (stateVars.has(rootName)) {
            findings.push(
              buildStateMutationFinding({
                rule: frontendRules[1],
                file,
                node,
                stateName: rootName,
                evidence: ['increment/decrement of state value'],
              })
            );
          }
        }

        if (node.type === 'CallExpression' && node.callee?.type === 'MemberExpression') {
          const rootName = getRootIdentifierName(node.callee.object);
          const methodName = getPropertyName(node.callee.property);

          if (stateVars.has(rootName) && mutatingArrayMethods.has(methodName)) {
            findings.push(
              buildStateMutationFinding({
                rule: frontendRules[1],
                file,
                node,
                stateName: rootName,
                evidence: [`mutating array method: ${methodName}`],
              })
            );
          }
        }
      });

      return findings.slice(0, 20);
    },
  },
  {
    id: 'frontend.dangerous-use-effect',
    name: 'Dangerous useEffect pattern',
    category: 'frontend',
    severity: RULE_SEVERITY.HIGH,
    description:
      'Detects async effect callbacks and subscription/timer effects without cleanup.',
    recommendation:
      'Move async work inside the effect body and return cleanup for subscriptions, timers, and listeners.',
    appliesTo: file =>
      file.scope === 'changed' &&
      file.isFrontend &&
      isJavaScriptLikeFile(file.normalizedPath) &&
      file.ast,
    check: file => {
      const findings = [];

      walkAst(file.ast, node => {
        if (!isUseEffectCall(node)) {
          return;
        }

        const callback = node.arguments[0];

        if (!callback) {
          return;
        }

        if (callback.async) {
          findings.push(
            createFinding({
              rule: frontendRules[2],
              file,
              line: getNodeLine(node),
              column: getNodeColumn(node),
              message: 'useEffect callback is async.',
              evidence: ['async effect callback'],
              confidence: 'high',
            })
          );
        }

        if (opensResourceWithoutCleanup(callback)) {
          findings.push(
            createFinding({
              rule: frontendRules[2],
              file,
              line: getNodeLine(node),
              column: getNodeColumn(node),
              message: 'useEffect starts a listener/timer without returning cleanup.',
              evidence: ['subscription or timer call', 'no cleanup return'],
              confidence: 'medium',
            })
          );
        }
      });

      return findings;
    },
  },
];

function collectStateVariables(ast) {
  const stateVars = new Set();

  walkAst(ast, node => {
    if (
      node.type !== 'VariableDeclarator' ||
      node.id?.type !== 'ArrayPattern' ||
      !isUseStateCall(node.init)
    ) {
      return;
    }

    const stateIdentifier = node.id.elements?.[0];

    if (stateIdentifier?.type === 'Identifier') {
      stateVars.add(stateIdentifier.name);
    }
  });

  return stateVars;
}

function collectStateSetters(ast) {
  const stateSetters = new Set();

  walkAst(ast, node => {
    if (
      node.type !== 'VariableDeclarator' ||
      node.id?.type !== 'ArrayPattern' ||
      !isUseStateCall(node.init)
    ) {
      return;
    }

    const setterIdentifier = node.id.elements?.[1];

    if (setterIdentifier?.type === 'Identifier') {
      stateSetters.add(setterIdentifier.name);
    }
  });

  return stateSetters;
}

function buildStateMutationFinding({ rule, file, node, stateName, evidence }) {
  return createFinding({
    rule,
    file,
    line: getNodeLine(node),
    column: getNodeColumn(node),
    message: `React state "${stateName}" is mutated directly.`,
    evidence,
    confidence: 'high',
    metadata: {
      stateName,
    },
  });
}

function opensResourceWithoutCleanup(callback) {
  const opensResource = containsCall(callback, call => {
    const calleeName = getCalleePropertyName(call);

    return ['addEventListener', 'setInterval', 'setTimeout', 'subscribe'].includes(
      calleeName
    );
  });

  if (!opensResource) {
    return false;
  }

  return !hasNode(callback.body || callback, child => child.type === 'ReturnStatement');
}
