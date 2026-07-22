import { dependencyResolverService } from './dependency-resolver.service.js';
import { importParserService } from './import-parser.service.js';
import {
  classifyModuleLayer,
  normalizeRepoPath,
} from '../../utils/repository-path.util.js';

class DependencyGraphService {
  buildGraph(files) {
    const normalizedFiles = files.map(file => ({
      ...file,
      path: normalizeRepoPath(file.path),
    }));

    const filePathSet = new Set(normalizedFiles.map(file => file.path));
    const nodes = new Map();
    const edges = [];
    const parseErrors = [];
    const externalDependencies = new Map();

    for (const file of normalizedFiles) {
      const parsedFile = importParserService.parseFile(file);

      if (parsedFile.parseError) {
        parseErrors.push(parsedFile.parseError);
      }

      nodes.set(file.path, {
        path: file.path,
        layer: classifyModuleLayer(file.path),
        size: file.size,
        imports: parsedFile.imports,
        exports: parsedFile.exports,
        dependencies: [],
        dependents: [],
        unresolvedImports: [],
        externalImports: [],
      });
    }

    for (const node of nodes.values()) {
      for (const importItem of node.imports) {
        const resolvedImport = dependencyResolverService.resolveImport({
          importerPath: node.path,
          importSource: importItem.source,
          filePathSet,
        });

        if (resolvedImport.type === 'local') {
          node.dependencies.push(resolvedImport.resolvedPath);

          edges.push({
            from: node.path,
            to: resolvedImport.resolvedPath,
            kind: importItem.kind,
            source: importItem.source,
          });

          continue;
        }

        if (resolvedImport.type === 'external') {
          node.externalImports.push(resolvedImport.packageName);
          incrementMapValue(externalDependencies, resolvedImport.packageName);
          continue;
        }

        node.unresolvedImports.push(importItem.source);
      }
    }

    for (const edge of edges) {
      const dependencyNode = nodes.get(edge.to);

      if (dependencyNode) {
        dependencyNode.dependents.push(edge.from);
      }
    }

    for (const node of nodes.values()) {
      node.dependencies = [...new Set(node.dependencies)].sort();
      node.dependents = [...new Set(node.dependents)].sort();
      node.externalImports = [...new Set(node.externalImports)].sort();
      node.unresolvedImports = [...new Set(node.unresolvedImports)].sort();
    }

    return {
      nodes,
      edges,
      parseErrors,
      externalDependencies: Object.fromEntries(
        [...externalDependencies.entries()].sort(([a], [b]) => a.localeCompare(b))
      ),
      summary: {
        totalNodes: nodes.size,
        totalEdges: edges.length,
        totalExternalPackages: externalDependencies.size,
        totalParseErrors: parseErrors.length,
      },
    };
  }
}

function incrementMapValue(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

export const dependencyGraphService = new DependencyGraphService();
