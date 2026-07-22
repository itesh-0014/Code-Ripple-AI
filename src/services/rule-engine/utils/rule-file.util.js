import {
  classifyModuleLayer,
  getRepoExtension,
  normalizeRepoPath,
} from '../../../utils/repository-path.util.js';

const frontendPathPattern =
  /(^|\/)(client|frontend|web|components|component|pages|page|screens|screen|views|view|hooks|hook)(\/|$)/i;

const backendPathPattern =
  /(^|\/)(server|backend|api|routes|route|controllers|controller|services|service|middlewares|middleware|models|model|repositories|repository|db|database)(\/|$)/i;

export function buildRuleFileContext({
  file,
  scope,
  changedFile,
  graphNode,
  ast,
  parseError,
}) {
  const normalizedPath = normalizeRepoPath(file.path);
  const content = normalizeLineEndings(file.content || '');

  return {
    originalFile: file,
    normalizedPath,
    extension: getRepoExtension(normalizedPath),
    layer: classifyModuleLayer(normalizedPath),
    content,
    lines: content.split('\n'),
    size: file.size || content.length,
    scope,
    changedFile,
    graphNode,
    ast,
    parseError,
    isBackend: isBackendFile(normalizedPath, content),
    isFrontend: isFrontendFile(normalizedPath, content),
  };
}

export function isJavaScriptLikeFile(filePath) {
  return ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(
    getRepoExtension(filePath)
  );
}

export function isBackendFile(filePath, content = '') {
  const normalizedPath = normalizeRepoPath(filePath);

  return (
    backendPathPattern.test(normalizedPath) ||
    /\b(express|mongoose|router\.|app\.|req\.|res\.)\b/.test(content)
  );
}

export function isFrontendFile(filePath, content = '') {
  const normalizedPath = normalizeRepoPath(filePath);

  return (
    ['.jsx', '.tsx'].includes(getRepoExtension(normalizedPath)) ||
    frontendPathPattern.test(normalizedPath) ||
    /\b(React|useEffect|useState|useMemo|useCallback|jsx)\b/.test(content)
  );
}

export function normalizeLineEndings(content) {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}
