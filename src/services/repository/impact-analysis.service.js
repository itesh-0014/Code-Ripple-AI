import { repositoryAnalysisConfig } from '../../config/repository.config.js';
import {
  classifyModuleLayer,
  isSourceFile,
  normalizeRepoPath,
} from '../../utils/repository-path.util.js';

class ImpactAnalysisService {
  analyze({ graph, changedFiles }) {
    const changedFileImpacts = changedFiles.map(file =>
      this.analyzeChangedFile(graph, file)
    );

    const affectedModuleMap = new Map();

    for (const changedFileImpact of changedFileImpacts) {
      for (const affectedModule of changedFileImpact.affectedModules) {
        const existing = affectedModuleMap.get(affectedModule.path);

        if (!existing || affectedModule.distance < existing.distance) {
          affectedModuleMap.set(affectedModule.path, affectedModule);
        }
      }
    }

    const affectedModules = [...affectedModuleMap.values()].sort(
      (a, b) => a.distance - b.distance || a.path.localeCompare(b.path)
    );

    return {
      changedFiles: changedFileImpacts,
      affectedModules,
      propagationChains: changedFileImpacts.flatMap(
        item => item.propagationChains
      ),
      riskSignals: this.buildRiskSignals(changedFileImpacts, affectedModules),
      summary: {
        changedSourceFiles: changedFileImpacts.filter(item => item.isSourceFile)
          .length,
        affectedModuleCount: affectedModules.length,
        affectedLayers: [...new Set(affectedModules.map(item => item.layer))],
        maxPropagationDepth: affectedModules.reduce(
          (maxDepth, item) => Math.max(maxDepth, item.distance),
          0
        ),
      },
    };
  }

  analyzeChangedFile(graph, changedFile) {
    const normalizedPath = normalizeRepoPath(changedFile.filename);
    const node = graph.nodes.get(normalizedPath);

    if (!node) {
      return {
        filename: normalizedPath,
        status: changedFile.status,
        isSourceFile: isSourceFile(normalizedPath),
        inDependencyGraph: false,
        layer: classifyModuleLayer(normalizedPath),
        directDependencies: [],
        directDependents: [],
        affectedModules: [],
        propagationChains: [],
      };
    }

    const traversal = this.traverseDependents(graph, node.path);

    return {
      filename: normalizedPath,
      status: changedFile.status,
      isSourceFile: true,
      inDependencyGraph: true,
      layer: node.layer,
      directDependencies: node.dependencies,
      directDependents: node.dependents,
      imports: node.imports,
      exports: node.exports,
      affectedModules: traversal.affectedModules,
      propagationChains: traversal.propagationChains,
    };
  }

  traverseDependents(graph, changedPath) {
    const queue = [
      {
        path: changedPath,
        distance: 0,
        chain: [changedPath],
      },
    ];

    const visited = new Set([changedPath]);
    const affectedModules = [];
    const propagationChains = [];

    while (queue.length > 0) {
      const current = queue.shift();
      const currentNode = graph.nodes.get(current.path);

      if (!currentNode) {
        continue;
      }

      if (current.distance >= repositoryAnalysisConfig.maxImpactDepth) {
        continue;
      }

      for (const dependentPath of currentNode.dependents) {
        if (visited.has(dependentPath)) {
          continue;
        }

        visited.add(dependentPath);

        const dependentNode = graph.nodes.get(dependentPath);
        const nextDistance = current.distance + 1;
        const nextChain = [...current.chain, dependentPath];

        affectedModules.push({
          path: dependentPath,
          layer: dependentNode?.layer || classifyModuleLayer(dependentPath),
          distance: nextDistance,
          reason: `${dependentPath} imports ${current.path}`,
          changedFile: changedPath,
        });

        propagationChains.push({
          changedFile: changedPath,
          affectedFile: dependentPath,
          distance: nextDistance,
          chain: nextChain,
        });

        queue.push({
          path: dependentPath,
          distance: nextDistance,
          chain: nextChain,
        });
      }
    }

    return {
      affectedModules,
      propagationChains,
    };
  }

  buildRiskSignals(changedFileImpacts, affectedModules) {
    const riskSignals = [];
    const affectedLayers = new Set(affectedModules.map(item => item.layer));

    for (const changedFileImpact of changedFileImpacts) {
      if (!changedFileImpact.isSourceFile) {
        continue;
      }

      if (!changedFileImpact.inDependencyGraph) {
        riskSignals.push({
          type: 'missing-source-context',
          level: 'medium',
          message: `${changedFileImpact.filename} was changed but was not present in the scanned dependency graph.`,
          evidence: [changedFileImpact.filename],
        });
      }

      if (changedFileImpact.layer === 'auth-security') {
        riskSignals.push({
          type: 'security-sensitive-change',
          level: 'high',
          message:
            'Authentication, token, session, or middleware code changed. Review protected routes and authorization flow carefully.',
          evidence: [changedFileImpact.filename],
        });
      }

      if (changedFileImpact.directDependents.length >= 5) {
        riskSignals.push({
          type: 'shared-module-change',
          level: 'high',
          message:
            'A widely imported source file changed. Small edits here may affect many modules.',
          evidence: [
            changedFileImpact.filename,
            `${changedFileImpact.directDependents.length} direct dependents`,
          ],
        });
      }

      if (changedFileImpact.affectedModules.length >= 10) {
        riskSignals.push({
          type: 'large-blast-radius',
          level: 'high',
          message:
            'This change has a broad dependency impact across the repository.',
          evidence: [
            changedFileImpact.filename,
            `${changedFileImpact.affectedModules.length} affected modules`,
          ],
        });
      }
    }

    if (affectedLayers.size >= 3) {
      riskSignals.push({
        type: 'cross-layer-impact',
        level: 'medium',
        message:
          'The PR affects multiple architectural layers, so review should include workflow-level behavior.',
        evidence: [...affectedLayers],
      });
    }

    return riskSignals;
  }
}

export const impactAnalysisService = new ImpactAnalysisService();
