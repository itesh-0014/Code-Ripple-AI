import { useMemo, useState } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from '@xyflow/react';
import type { DependencyResponse, GraphNode } from '../../types/dashboard';

const layerColors: Record<string, string> = {
  'auth-security': '#f43f5e',
  data: '#f59e0b',
  'frontend-ui': '#8b5cf6',
  service: '#65d9a5',
};

export function DependencyGraph({ data }: { data: DependencyResponse }) {
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const impacted = useMemo(() => new Set(data.impactedFiles), [data.impactedFiles]);
  const nodes = useMemo<Node[]>(() => data.graph.nodes.map((node, index) => ({
    id: node.path,
    position: {
      x: (index % 3) * 270,
      y: Math.floor(index / 3) * 150,
    },
    data: { label: shortPath(node.path), graphNode: node },
    style: {
      width: 210,
      borderRadius: 14,
      border: `1px solid ${impacted.has(node.path) ? '#b8f34a' : '#334139'}`,
      boxShadow: impacted.has(node.path) ? '0 0 0 3px rgba(184,243,74,.13)' : 'none',
      background: '#111714',
      color: '#e9eee9',
      fontFamily: 'IBM Plex Mono',
      fontSize: 11,
      padding: 12,
      borderLeft: `4px solid ${layerColors[node.layer || 'service'] || '#65d9a5'}`,
    },
  })), [data.graph.nodes, impacted]);
  const edges = useMemo<Edge[]>(() => data.graph.edges.map((edge, index) => ({
    id: `${edge.from}-${edge.to}-${index}`,
    source: edge.from,
    target: edge.to,
    animated: impacted.has(edge.from) || impacted.has(edge.to),
    style: { stroke: impacted.has(edge.from) ? '#b8f34a' : '#607067' },
  })), [data.graph.edges, impacted]);
  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    setSelected(node.data.graphNode as GraphNode);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
      <div className="panel h-[640px] overflow-hidden !bg-ink">
        <ReactFlow nodes={nodes} edges={edges} onNodeClick={handleNodeClick} fitView>
          <Background color="#29342e" gap={22} />
          <MiniMap nodeColor="#65d9a5" maskColor="rgba(11,15,13,.75)" />
          <Controls />
        </ReactFlow>
      </div>
      <aside className="panel p-5">
        <p className="eyebrow">Node inspector</p>
        {selected ? (
          <div className="mt-5">
            <h3 className="break-all font-mono text-sm font-medium">{selected.path}</h3>
            <span className="mt-3 inline-block rounded-full bg-stone-100 px-2.5 py-1 font-mono text-[10px] dark:bg-line">
              {selected.layer || 'unclassified'}
            </span>
            <GraphList title="Dependencies" items={selected.dependencies} />
            <GraphList title="Dependents" items={selected.dependents} />
          </div>
        ) : (
          <p className="mt-4 text-sm leading-6 text-stone-500">
            Select a node to inspect its layer, imports, and downstream dependents.
          </p>
        )}
        <div className="mt-8 border-t pt-5">
          <p className="text-xs font-medium">Legend</p>
          <div className="mt-3 space-y-2 text-xs text-stone-500">
            {Object.entries(layerColors).map(([layer, color]) => (
              <div key={layer} className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ background: color }} /> {layer}
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function GraphList({ title, items = [] }: { title: string; items?: string[] }) {
  return (
    <div className="mt-6">
      <p className="text-xs font-medium">{title}</p>
      <ul className="mt-2 space-y-2">
        {items.length ? items.map(item => (
          <li key={item} className="break-all rounded-lg bg-stone-50 p-2 font-mono text-[10px] text-stone-500 dark:bg-ink">
            {item}
          </li>
        )) : <li className="text-xs text-stone-400">None</li>}
      </ul>
    </div>
  );
}

function shortPath(path: string) {
  const parts = path.split('/');
  return parts.length > 2 ? `…/${parts.slice(-2).join('/')}` : path;
}
