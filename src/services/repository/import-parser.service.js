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

class ImportParserService {
  parseFile(file) {
    const imports = [];
    const exports = [];

    try {
      const ast = parse(file.content, {
        sourceType: 'unambiguous',
        errorRecovery: true,
        plugins: parserPlugins,
      });

      walkAst(ast, node => {
        if (node.type === 'ImportDeclaration') {
          imports.push({
            source: node.source.value,
            kind: 'static-import',
            importedNames: node.specifiers.map(specifier =>
              getImportSpecifierName(specifier)
            ),
          });
        }

        if (
          node.type === 'CallExpression' &&
          node.callee?.type === 'Identifier' &&
          node.callee.name === 'require'
        ) {
          const source = getStringLiteralValue(node.arguments?.[0]);

          if (source) {
            imports.push({
              source,
              kind: 'commonjs-require',
              importedNames: [],
            });
          }
        }

        if (node.type === 'ImportExpression') {
          const source = getStringLiteralValue(node.source);

          if (source) {
            imports.push({
              source,
              kind: 'dynamic-import',
              importedNames: [],
            });
          }
        }

        if (node.type === 'CallExpression' && node.callee?.type === 'Import') {
          const source = getStringLiteralValue(node.arguments?.[0]);

          if (source) {
            imports.push({
              source,
              kind: 'dynamic-import',
              importedNames: [],
            });
          }
        }

        if (
          (node.type === 'ExportNamedDeclaration' ||
            node.type === 'ExportAllDeclaration') &&
          node.source
        ) {
          imports.push({
            source: node.source.value,
            kind: 're-export',
            importedNames: [],
          });
        }

        collectExports(node, exports);
      });

      return {
        filePath: file.path,
        imports: dedupeImports(imports),
        exports: dedupeExports(exports),
        parseError: null,
      };
    } catch (error) {
      return {
        filePath: file.path,
        imports,
        exports,
        parseError: {
          filePath: file.path,
          message: error.message,
        },
      };
    }
  }
}

function walkAst(node, visitor) {
  if (!node || typeof node !== 'object') {
    return;
  }

  if (typeof node.type === 'string') {
    visitor(node);
  }

  for (const [key, value] of Object.entries(node)) {
    if (
      key === 'loc' ||
      key === 'start' ||
      key === 'end' ||
      key === 'extra' ||
      key === 'comments' ||
      key === 'errors'
    ) {
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach(child => {
        if (child && typeof child.type === 'string') {
          walkAst(child, visitor);
        }
      });

      continue;
    }

    if (value && typeof value.type === 'string') {
      walkAst(value, visitor);
    }
  }
}

function getImportSpecifierName(specifier) {
  if (specifier.type === 'ImportDefaultSpecifier') {
    return 'default';
  }

  if (specifier.type === 'ImportNamespaceSpecifier') {
    return '*';
  }

  return specifier.imported?.name || specifier.imported?.value || 'unknown';
}

function getStringLiteralValue(node) {
  if (!node) {
    return null;
  }

  if (node.type === 'StringLiteral') {
    return node.value;
  }

  if (node.type === 'Literal' && typeof node.value === 'string') {
    return node.value;
  }

  return null;
}

function collectExports(node, exports) {
  if (node.type === 'ExportDefaultDeclaration') {
    exports.push({
      name: 'default',
      kind: 'default-export',
    });
    return;
  }

  if (node.type === 'ExportAllDeclaration') {
    exports.push({
      name: '*',
      kind: 'export-all',
    });
    return;
  }

  if (node.type !== 'ExportNamedDeclaration') {
    return;
  }

  node.specifiers?.forEach(specifier => {
    exports.push({
      name:
        specifier.exported?.name ||
        specifier.exported?.value ||
        specifier.local?.name ||
        'unknown',
      kind: 'named-export',
    });
  });

  const declaration = node.declaration;

  if (!declaration) {
    return;
  }

  if (
    declaration.type === 'FunctionDeclaration' ||
    declaration.type === 'ClassDeclaration'
  ) {
    exports.push({
      name: declaration.id?.name || 'anonymous',
      kind: 'named-export',
    });
  }

  if (declaration.type === 'VariableDeclaration') {
    declaration.declarations.forEach(variableDeclarator => {
      if (variableDeclarator.id?.type === 'Identifier') {
        exports.push({
          name: variableDeclarator.id.name,
          kind: 'named-export',
        });
      }
    });
  }
}

function dedupeImports(imports) {
  const seen = new Set();

  return imports.filter(item => {
    const key = `${item.kind}:${item.source}:${item.importedNames.join(',')}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function dedupeExports(exports) {
  const seen = new Set();

  return exports.filter(item => {
    const key = `${item.kind}:${item.name}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export const importParserService = new ImportParserService();
