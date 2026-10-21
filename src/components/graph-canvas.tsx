"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import cytoscape, { type Core } from "cytoscape";
import type { EntityType, GraphNode, IntelligenceGraph } from "@/lib/graph";
import { ENTITY_TYPES, RELATION_LABELS, TYPE_LABELS } from "@/lib/graph";
import { searchGraph } from "@/lib/graph-ops";

export type GraphMode = "force" | "hierarchy" | "radial" | "timeline" | "evidence" | "path";
export const GRAPH_MODES: { id: GraphMode; label: string }[] = [
  { id: "force", label: "Силовой" }, { id: "hierarchy", label: "Иерархия" },
  { id: "radial", label: "Радиальный" }, { id: "timeline", label: "Временная шкала" },
  { id: "evidence", label: "Доказательства" }, { id: "path", label: "Пути риска" },
];

export interface GraphCanvasHandle {
  fit: () => void;
  center: (id: string) => void;
  zoom: (delta: number) => void;
  exportPng: () => void;
}

interface Props {
  graph: IntelligenceGraph;
  mode: GraphMode;
  selectedIds: string[];
  query: string;
  visibleTypes: Set<EntityType>;
  visibleNodeIds?: Set<string>;
  showLabels: boolean;
  positions: Record<string, { x: number; y: number }>;
  onSelect: (id: string, additive: boolean) => void;
  onPositions: (positions: Record<string, { x: number; y: number }>) => void;
  onLayout: (positions: Record<string, { x: number; y: number }>) => void;
  onTogglePin: (id: string) => void;
  onExpand: (id: string) => void;
}

const colors: Record<EntityType, string> = {
  organization: "#a78bfa", domain: "#8b5cf6", subdomain: "#9b7cf7", ip: "#60a5fa",
  dns: "#38bdf8", certificate: "#67e8f9", person: "#f0abfc", technology: "#a5b4fc",
  application: "#818cf8", repository: "#c4b5fd", finding: "#fbbf24", vulnerability: "#f87171", asset: "#34d399",
};

function runLayout(cy: Core, mode: GraphMode): ReturnType<Core["layout"]> | null {
  const active = cy.nodes(":visible");
  if (!active.length) return null;
  const common = { animate: false, fit: true, padding: 76, nodeDimensionsIncludeLabels: true };
  const layout = mode === "hierarchy"
    ? active.layout({ ...common, name: "breadthfirst", directed: true, spacingFactor: 1.15, circle: false, roots: ["#org"] })
    : mode === "radial"
      ? active.layout({ ...common, name: "concentric", minNodeSpacing: 34, concentric: (ele) => ele.id() === "org" ? 10 : ele.connectedEdges().length, levelWidth: () => 2 })
      : mode === "timeline"
        ? active.layout({ ...common, name: "grid", rows: 4, sort: (a, b) => a.data("order") - b.data("order"), spacingFactor: 1.3 })
        : mode === "evidence"
          ? active.layout({ ...common, name: "breadthfirst", directed: true, spacingFactor: 1.05, roots: active.filter("[type = 'finding'], [type = 'vulnerability']").map((node) => `#${node.id()}`) })
          : mode === "path"
            ? active.layout({ ...common, name: "breadthfirst", directed: true, spacingFactor: 1.25, roots: ["#org"], maximal: true })
            : active.layout({ ...common, name: "cose", idealEdgeLength: 142, nodeRepulsion: 7900, gravity: 0.18, numIter: 450, randomize: false });
  layout.run();
  return layout;
}

export const GraphCanvas = forwardRef<GraphCanvasHandle, Props>(function GraphCanvas({ graph, mode, selectedIds, query, visibleTypes, visibleNodeIds, showLabels, positions, onSelect, onPositions, onLayout, onTogglePin, onExpand }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const layoutRef = useRef<ReturnType<Core["layout"]> | null>(null);
  const callbacks = useRef({ onSelect, onPositions, onLayout, onTogglePin, onExpand });
  callbacks.current = { onSelect, onPositions, onLayout, onTogglePin, onExpand };

  useImperativeHandle(ref, () => ({
    fit: () => cyRef.current?.fit(cyRef.current.elements(":visible"), 82),
    center: (id) => { const node = cyRef.current?.getElementById(id); if (node?.length) cyRef.current?.animate({ center: { eles: node }, duration: 360 }); },
    zoom: (delta) => { const cy = cyRef.current; if (cy) cy.zoom({ level: Math.max(0.35, Math.min(2.25, cy.zoom() + delta)), renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } }); },
    exportPng: () => {
      const cy = cyRef.current;
      if (!cy) return;
      const link = document.createElement("a");
      link.download = "nightfall-graph-demo.png";
      link.href = cy.png({ output: "base64uri", full: true, scale: 2, bg: "#101116", maxWidth: 4000, maxHeight: 3000 });
      link.click();
    },
  }), []);

  useEffect(() => {
    if (!hostRef.current || cyRef.current) return;
    const initialPositions = positions;
    const elements: cytoscape.ElementDefinition[] = [
      ...graph.nodes.map((n, index) => ({
        group: "nodes" as const, data: { id: n.id, label: n.label, type: n.type, confidence: n.confidence, status: n.status, source: n.source, order: index, size: Math.min(62, 34 + n.confidence * 14 + (n.type === "organization" ? 18 : 0)), color: colors[n.type], pinned: n.pinned },
        position: initialPositions[n.id] ?? (n.x !== undefined && n.y !== undefined ? { x: n.x, y: n.y } : undefined),
      })),
      ...graph.edges.map((e) => ({ group: "edges" as const, data: { id: e.id, source: e.source, target: e.target, label: RELATION_LABELS[e.relation], confidence: e.confidence, status: e.status, relation: e.relation } })),
    ];
    const cy = cytoscape({
      container: hostRef.current, elements, minZoom: 0.25, maxZoom: 2.5, wheelSensitivity: 0.22,
      layout: { name: "preset" },
      style: [
        { selector: "node", style: { "background-color": "data(color)", "background-opacity": 0.16, "border-color": "data(color)", "border-width": 1.5, "width": "data(size)", "height": "data(size)", label: "data(label)", color: "#e8e8f0", "font-family": "Inter, Segoe UI, sans-serif", "font-size": 10, "font-weight": 500, "text-wrap": "ellipsis", "text-max-width": "142", "text-valign": "bottom", "text-margin-y": 9, "text-outline-color": "#101116", "text-outline-width": 2, "overlay-opacity": 0, "transition-property": "opacity, border-width, background-opacity", "transition-duration": 180 } },
        { selector: "node[type = 'organization']", style: { shape: "round-rectangle", "font-size": 12, "font-weight": 700 } },
        { selector: "node[type = 'domain'], node[type = 'subdomain']", style: { shape: "ellipse" } },
        { selector: "node[type = 'ip']", style: { shape: "hexagon" } },
        { selector: "node[type = 'dns']", style: { shape: "tag" } },
        { selector: "node[type = 'certificate']", style: { shape: "pentagon" } },
        { selector: "node[type = 'person']", style: { shape: "ellipse" } },
        { selector: "node[type = 'technology']", style: { shape: "triangle" } },
        { selector: "node[type = 'application']", style: { shape: "round-rectangle" } },
        { selector: "node[type = 'repository']", style: { shape: "barrel" } },
        { selector: "node[type = 'finding']", style: { shape: "octagon" } },
        { selector: "node[type = 'vulnerability']", style: { shape: "star" } },
        { selector: "node[type = 'asset']", style: { shape: "rectangle" } },
        { selector: "edge", style: { width: "mapData(confidence, 0.25, 1, 1, 2.1)", "line-color": "#8c8da2", "target-arrow-color": "#8c8da2", "target-arrow-shape": "triangle", "curve-style": "bezier", "arrow-scale": 0.72, label: "data(label)", color: "#9698ab", "font-size": 8, "text-rotation": "autorotate", "text-background-color": "#101116", "text-background-opacity": 0.82, "text-background-padding": "2px", "line-style": "solid", "transition-property": "opacity, line-color, width", "transition-duration": 180 } },
        { selector: "edge[status = 'confirmed']", style: { "line-color": "#567b69", "target-arrow-color": "#567b69" } },
        { selector: "edge[status = 'hypothesis']", style: { "line-color": "#aa8749", "target-arrow-color": "#aa8749", "line-style": "dashed" } },
        { selector: "edge[status = 'unknown']", style: { "line-color": "#aa626d", "target-arrow-color": "#aa626d", "line-style": "dotted" } },
        { selector: ".dimmed", style: { opacity: 0.12 } },
        { selector: ".neighbor", style: { opacity: 1, "border-width": 2.2 } },
        { selector: ".focus-node", style: { "background-opacity": 0.34, "border-width": 3, "underlay-color": "#8b5cf6", "underlay-opacity": 0.2, "underlay-padding": 8 } },
        { selector: ".focus-edge", style: { opacity: 1, width: 2.7 } },
        { selector: ".search-hit", style: { "border-width": 3, "underlay-color": "#60a5fa", "underlay-opacity": 0.14, "underlay-padding": 6 } },
        { selector: "node[pinned = true]", style: { "border-style": "double", "border-width": 3 } },
      ],
    });
    cyRef.current = cy;
    cy.on("tap", "node", (event) => callbacks.current.onSelect(event.target.id(), Boolean((event.originalEvent as MouseEvent | undefined)?.shiftKey)));
    cy.on("tap", (event) => { if (event.target === cy) callbacks.current.onSelect("", false); });
    cy.on("dragfree", "node", () => {
      const next: Record<string, { x: number; y: number }> = {};
      cy.nodes().forEach((n) => { const p = n.position(); next[n.id()] = { x: p.x, y: p.y }; });
      callbacks.current.onPositions(next);
    });
    cy.on("layoutstop", () => {
      const next: Record<string, { x: number; y: number }> = {};
      cy.nodes().forEach((n) => { const p = n.position(); next[n.id()] = { x: p.x, y: p.y }; });
      callbacks.current.onLayout(next);
    });
    cy.on("cxttap", "node", (event) => callbacks.current.onTogglePin(event.target.id()));
    cy.on("dbltap", "node", (event) => callbacks.current.onExpand(event.target.id()));
    return () => {
      layoutRef.current?.stop();
      layoutRef.current = null;
      cy.stop(true);
      cy.destroy();
      cyRef.current = null;
    };
  }, []);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const nodeIds = new Set(graph.nodes.map((node) => node.id));
    const edgeIds = new Set(graph.edges.map((edge) => edge.id));
    cy.batch(() => {
      cy.nodes().filter((node) => !nodeIds.has(node.id())).remove();
      cy.edges().filter((edge) => !edgeIds.has(edge.id())).remove();
      graph.nodes.forEach((node, index) => {
        const existing = cy.getElementById(node.id);
        const data = { id: node.id, label: node.label, type: node.type, confidence: node.confidence, status: node.status, source: node.source, order: index, size: Math.min(62, 34 + node.confidence * 14 + (node.type === "organization" ? 18 : 0)), color: colors[node.type], pinned: node.pinned };
        if (existing.length) {
          existing.data(data);
          const saved = positions[node.id] ?? (node.x !== undefined && node.y !== undefined ? { x: node.x, y: node.y } : undefined);
          if (saved && (Math.abs(existing.position("x") - saved.x) > 1 || Math.abs(existing.position("y") - saved.y) > 1)) existing.position(saved);
        }
        else cy.add({ group: "nodes", data, position: positions[node.id] ?? { x: cy.width() / 2 + Math.random() * 80 - 40, y: cy.height() / 2 + Math.random() * 80 - 40 } });
      });
      graph.edges.forEach((edge) => {
        const existing = cy.getElementById(edge.id);
        const data = { id: edge.id, source: edge.source, target: edge.target, label: RELATION_LABELS[edge.relation], confidence: edge.confidence, status: edge.status, relation: edge.relation };
        if (existing.length) existing.data(data);
        else if (cy.getElementById(edge.source).length && cy.getElementById(edge.target).length) cy.add({ group: "edges", data });
      });
    });
  }, [graph, positions]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const matches = new Set(searchGraph(graph, query).map((n) => n.id));
    const selected = new Set(selectedIds);
    const neighbors = new Set<string>();
    graph.edges.forEach((edge) => {
      if (selected.has(edge.source)) neighbors.add(edge.target);
      if (selected.has(edge.target)) neighbors.add(edge.source);
    });
    cy.batch(() => {
      cy.nodes().forEach((n) => {
        const visible = visibleTypes.has(n.data("type") as EntityType) && (!visibleNodeIds || visibleNodeIds.has(n.id()));
        n.style("display", visible ? "element" : "none");
        n.toggleClass("focus-node", selected.has(n.id()));
        n.toggleClass("neighbor", neighbors.has(n.id()));
        n.toggleClass("dimmed", selected.size > 0 && !selected.has(n.id()) && !neighbors.has(n.id()) || query.trim().length > 0 && !matches.has(n.id()));
        n.toggleClass("search-hit", query.trim().length > 0 && matches.has(n.id()));
      });
      cy.edges().forEach((e) => {
        const from = e.source(); const to = e.target();
        const visible = from.style("display") !== "none" && to.style("display") !== "none";
        e.style("display", visible ? "element" : "none");
        e.toggleClass("dimmed", selected.size > 0 && !selected.has(from.id()) && !selected.has(to.id()));
        e.toggleClass("focus-edge", selected.has(from.id()) || selected.has(to.id()));
      });
    });
  }, [graph, selectedIds, query, visibleTypes, visibleNodeIds]);

  useEffect(() => { const cy = cyRef.current; if (cy) cy.edges().style("label", showLabels ? "data(label)" : ""); }, [showLabels]);
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    layoutRef.current?.stop();
    layoutRef.current = runLayout(cy, mode);
    return () => { layoutRef.current?.stop(); layoutRef.current = null; };
  }, [mode, graph.nodes.length, graph.edges.length]);

  return <div ref={hostRef} className="graph-host" aria-label="Интерактивное полотно графа сущностей" role="application" />;
});

export const TYPE_COLOR = colors;
export const ALL_TYPES = ENTITY_TYPES;
export function describeNode(node: GraphNode) { return TYPE_LABELS[node.type]; }

