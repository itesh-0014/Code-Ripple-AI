import path from 'path';
import { repositoryAnalysisConfig } from '../config/repository.config.js';

export function normalizeRepoPath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/^\/+/, '');
}

export function getRepoExtension(filePath) {
  return path.posix.extname(normalizeRepoPath(filePath)).toLowerCase();
}

export function isSourceFile(filePath) {
  return repositoryAnalysisConfig.sourceFileExtensions.includes(
    getRepoExtension(filePath)
  );
}

export function isSemanticContextFile(filePath) {
  const normalizedPath = normalizeRepoPath(filePath);
  const fileName = path.posix.basename(normalizedPath).toLowerCase();

  return (
    repositoryAnalysisConfig.semanticFileExtensions.includes(
      getRepoExtension(normalizedPath)
    ) ||
    repositoryAnalysisConfig.semanticFileNames.includes(fileName)
  );
}

export function shouldIgnoreRepoPath(filePath) {
  const normalizedPath = normalizeRepoPath(filePath);
  const fileName = path.posix.basename(normalizedPath).toLowerCase();

  if (repositoryAnalysisConfig.ignoredFileNames.includes(fileName)) {
    return true;
  }

  const segments = normalizedPath
    .split('/')
    .filter(Boolean);

  return segments.some(segment =>
    repositoryAnalysisConfig.ignoredPathSegments.includes(segment)
  );
}

export function classifyModuleLayer(filePath) {
  const normalizedPath = normalizeRepoPath(filePath).toLowerCase();

  if (/(auth|jwt|session|token|middleware)/.test(normalizedPath)) {
    return 'auth-security';
  }

  if (/(route|routes|controller|controllers|api)/.test(normalizedPath)) {
    return 'api';
  }

  if (/(model|models|schema|schemas|repository|repositories|db|database)/.test(normalizedPath)) {
    return 'data';
  }

  if (/(service|services|usecase|usecases)/.test(normalizedPath)) {
    return 'business-logic';
  }

  if (/(component|components|page|pages|screen|screens|view|views)/.test(normalizedPath)) {
    return 'frontend-ui';
  }

  if (/(config|env|constant|constants)/.test(normalizedPath)) {
    return 'configuration';
  }

  if (/(util|utils|helper|helpers|lib|shared|common)/.test(normalizedPath)) {
    return 'shared-utility';
  }

  return 'application';
}
