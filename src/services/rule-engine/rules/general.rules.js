import { createFinding } from '../rule-result.factory.js';
import { RULE_SEVERITY } from '../rule-severity.js';
import {
  getFunctionDisplayName,
  getNodeColumn,
  getNodeLine,
  walkAst,
} from '../utils/javascript-ast.util.js';
import { isJavaScriptLikeFile } from '../utils/rule-file.util.js';

const largeFunctionLineLimit = 80;
const maxLineFindingsPerRule = 20;

export const generalRules = [
  {
    id: 'general.parse-error',
    name: 'JavaScript parse error',
    category: 'general',
    severity: RULE_SEVERITY.HIGH,
    description:
      'Flags changed JavaScript/TypeScript files that cannot be parsed safely.',
    recommendation:
      'Fix the syntax error before relying on dependency, rule, or AI review output.',
    appliesTo: file => file.scope === 'changed' && isJavaScriptLikeFile(file.normalizedPath),
    check: file => {
      if (!file.parseError) {
        return [];
      }

      const location = extractParseErrorLocation(file.parseError.message);

      return [
        createFinding({
          rule: generalRules[0],
          file,
          line: location.line,
          column: location.column,
          message: `Parser could not analyze ${file.normalizedPath}.`,
          evidence: [file.parseError.message],
          confidence: 'high',
        }),
      ];
    },
  },
  {
    id: 'general.console-log',
    name: 'Console log left in source',
    category: 'general',
    severity: RULE_SEVERITY.LOW,
    description:
      'Detects console.log/debug/trace statements in changed source files.',
    recommendation:
      'Use a structured logger or remove development logging before merging.',
    appliesTo: file => file.scope === 'changed' && isJavaScriptLikeFile(file.normalizedPath),
    check: file =>
      findMatchingLines(file, /\bconsole\.(log|debug|trace)\s*\(/, match =>
        createFinding({
          rule: generalRules[1],
          file,
          line: match.line,
          column: match.column,
          message: 'Development console logging is present in changed code.',
          evidence: [`console.${match.groups[1]} call`],
          confidence: 'high',
        })
      ),
  },
  {
    id: 'general.todo-fixme',
    name: 'TODO or FIXME marker',
    category: 'general',
    severity: RULE_SEVERITY.LOW,
    description: 'Detects TODO, FIXME, HACK, or XXX markers in changed files.',
    recommendation:
      'Convert the marker into a tracked issue, or resolve it before merge if it blocks correctness.',
    appliesTo: file => file.scope === 'changed',
    check: file =>
      findMatchingLines(file, /\b(TODO|FIXME|HACK|XXX)\b/i, match =>
        createFinding({
          rule: generalRules[2],
          file,
          line: match.line,
          column: match.column,
          message: `${match.groups[1].toUpperCase()} marker found in changed code.`,
          evidence: [safeLinePreview(match.text)],
          confidence: 'medium',
        })
      ),
  },
  {
    id: 'general.commented-dead-code',
    name: 'Commented-out code',
    category: 'general',
    severity: RULE_SEVERITY.LOW,
    description:
      'Detects comments that look like disabled JavaScript/TypeScript code.',
    recommendation:
      'Remove commented code or move the reasoning into a short explanatory comment.',
    appliesTo: file => file.scope === 'changed' && isJavaScriptLikeFile(file.normalizedPath),
    check: file =>
      findMatchingLines(
        file,
        /^\s*\/\/\s*(const|let|var|if|for|while|return|await|import|export|function|class|router\.|app\.|res\.|req\.)\b/,
        match =>
          createFinding({
            rule: generalRules[3],
            file,
            line: match.line,
            column: match.column,
            message: 'Commented-out code was detected.',
            evidence: [safeLinePreview(match.text)],
            confidence: 'medium',
          })
      ),
  },
  {
    id: 'general.large-function',
    name: 'Large function',
    category: 'general',
    severity: RULE_SEVERITY.MEDIUM,
    description:
      'Detects changed functions that are large enough to make review and testing harder.',
    recommendation:
      'Split the function around validation, data access, and response-building responsibilities.',
    appliesTo: file =>
      file.scope === 'changed' && isJavaScriptLikeFile(file.normalizedPath) && file.ast,
    check: file => {
      const findings = [];

      walkAst(file.ast, (node, parent) => {
        if (!isFunctionNode(node) || !node.loc?.start || !node.loc?.end) {
          return;
        }

        const lineCount = node.loc.end.line - node.loc.start.line + 1;

        if (lineCount <= largeFunctionLineLimit) {
          return;
        }

        findings.push(
          createFinding({
            rule: generalRules[4],
            file,
            line: getNodeLine(node),
            column: getNodeColumn(node),
            message: `Function "${getFunctionDisplayName(
              node,
              parent
            )}" is ${lineCount} lines long.`,
            evidence: [`${lineCount} lines`, `limit ${largeFunctionLineLimit}`],
            confidence: 'high',
            metadata: {
              lineCount,
              limit: largeFunctionLineLimit,
            },
          })
        );
      });

      return findings;
    },
  },
];

function findMatchingLines(file, pattern, buildFinding) {
  const findings = [];

  file.lines.forEach((lineText, index) => {
    if (findings.length >= maxLineFindingsPerRule) {
      return;
    }

    const match = lineText.match(pattern);

    if (!match) {
      return;
    }

    findings.push(
      buildFinding({
        line: index + 1,
        column: match.index || 0,
        text: lineText,
        groups: match,
      })
    );
  });

  return findings;
}

function isFunctionNode(node) {
  return [
    'FunctionDeclaration',
    'FunctionExpression',
    'ArrowFunctionExpression',
    'ObjectMethod',
    'ClassMethod',
    'ClassPrivateMethod',
  ].includes(node.type);
}

function safeLinePreview(lineText) {
  const trimmed = lineText.trim();

  return trimmed.length > 140 ? `${trimmed.slice(0, 137)}...` : trimmed;
}

function extractParseErrorLocation(message) {
  const match = String(message || '').match(/\((\d+):(\d+)\)/);

  if (!match) {
    return {
      line: 1,
      column: 0,
    };
  }

  return {
    line: Number(match[1]),
    column: Number(match[2]),
  };
}
