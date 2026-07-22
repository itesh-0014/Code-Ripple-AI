import { parse } from '@babel/parser';

const parserPlugins = [
  'jsx',
  'typescript',
  'decorators-legacy',
  'classProperties',
  'classPrivateProperties',
  'classPrivateMethods',
  'dynamicImport',
  'exportDefaultFrom',
  'exportNamespaceFrom',
  'importMeta',
  'objectRestSpread',
  'optionalChaining',
  'topLevelAwait',
];

const ignoredTraversalKeys = new Set([
  'loc',
  'start',
  'end',
  'extra',
  'comments',
  'errors',
  'leadingComments',
  'innerComments',
  'trailingComments',
]);

export function parseJavaScriptFile(file) {
  try {
    return {
      ast: parse(file.content || '', {
        sourceType: 'unambiguous',
        errorRecovery: true,
        plugins: parserPlugins,
        sourceFilename: file.path,
      }),
      parseError: null,
    };
  } catch (error) {
    return {
      ast: null,
      parseError: {
        filePath: file.path,
        message: error.message,
      },
    };
  }
}

export function walkAst(node, visitor, parent = null) {
  if (!node || typeof node !== 'object') {
    return;
  }

  if (typeof node.type === 'string') {
    visitor(node, parent);
  }

  for (const [key, value] of Object.entries(node)) {
    if (ignoredTraversalKeys.has(key)) {
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach(child => {
        if (child && typeof child.type === 'string') {
          walkAst(child, visitor, node);
        }
      });

      continue;
    }

    if (value && typeof value.type === 'string') {
      walkAst(value, visitor, node);
    }
  }
}

export function hasNode(astNode, predicate) {
  let found = false;

  walkAst(astNode, node => {
    if (!found && predicate(node)) {
      found = true;
    }
  });

  return found;
}

export function getNodeLine(node) {
  return node?.loc?.start?.line || 1;
}

export function getNodeColumn(node) {
  return node?.loc?.start?.column || 0;
}

export function getCalleePropertyName(callExpression) {
  const callee = callExpression?.callee;

  if (!callee) {
    return null;
  }

  if (callee.type === 'Identifier') {
    return callee.name;
  }

  if (callee.type !== 'MemberExpression') {
    return null;
  }

  return getPropertyName(callee.property);
}

export function getPropertyName(propertyNode) {
  if (!propertyNode) {
    return null;
  }

  if (propertyNode.type === 'Identifier') {
    return propertyNode.name;
  }

  if (
    propertyNode.type === 'StringLiteral' ||
    propertyNode.type === 'NumericLiteral'
  ) {
    return String(propertyNode.value);
  }

  if (propertyNode.type === 'Literal') {
    return String(propertyNode.value);
  }

  return null;
}

export function getRootIdentifierName(node) {
  if (!node) {
    return null;
  }

  if (node.type === 'Identifier') {
    return node.name;
  }

  if (node.type === 'ThisExpression') {
    return 'this';
  }

  if (node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') {
    return getRootIdentifierName(node.object);
  }

  return null;
}

export function isUseEffectCall(node) {
  if (node?.type !== 'CallExpression') {
    return false;
  }

  if (node.callee?.type === 'Identifier') {
    return node.callee.name === 'useEffect';
  }

  if (node.callee?.type === 'MemberExpression') {
    return (
      getRootIdentifierName(node.callee.object) === 'React' &&
      getPropertyName(node.callee.property) === 'useEffect'
    );
  }

  return false;
}

export function isUseStateCall(node) {
  if (node?.type !== 'CallExpression') {
    return false;
  }

  if (node.callee?.type === 'Identifier') {
    return node.callee.name === 'useState';
  }

  if (node.callee?.type === 'MemberExpression') {
    return (
      getRootIdentifierName(node.callee.object) === 'React' &&
      getPropertyName(node.callee.property) === 'useState'
    );
  }

  return false;
}

export function containsReqAccess(node) {
  return hasNode(node, child => {
    if (child.type !== 'MemberExpression') {
      return false;
    }

    return getRootIdentifierName(child) === 'req';
  });
}

export function containsCall(node, predicate) {
  return hasNode(
    node,
    child => child.type === 'CallExpression' && predicate(child)
  );
}

export function getFunctionDisplayName(node, parent) {
  if (node.id?.name) {
    return node.id.name;
  }

  if (parent?.type === 'VariableDeclarator' && parent.id?.type === 'Identifier') {
    return parent.id.name;
  }

  if (
    parent?.type === 'ObjectProperty' ||
    parent?.type === 'ObjectMethod' ||
    parent?.type === 'ClassMethod'
  ) {
    return getPropertyName(parent.key) || 'anonymous';
  }

  return 'anonymous';
}

export function getFunctionParams(node) {
  return (node.params || [])
    .map(param => {
      if (param.type === 'Identifier') {
        return param.name;
      }

      if (param.type === 'AssignmentPattern' && param.left?.type === 'Identifier') {
        return param.left.name;
      }

      return null;
    })
    .filter(Boolean);
}
