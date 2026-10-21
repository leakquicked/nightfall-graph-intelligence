import { describe, expect, it } from "vitest";
import { demoGraph } from "./graph";
import { connectedEdges, filterGraph, graphNeighbors, searchGraph, updateSelection } from "./graph-ops";

describe("операции графа", () => {
  it("находит имена и атрибуты без учёта регистра", () => {
    expect(searchGraph(demoGraph, "PORTAL").map((node) => node.id)).toContain("portal");
    expect(searchGraph(demoGraph, "AS64500").map((node) => node.id)).toContain("edge-ip");
  });

  it("возвращает соседей выбранной сущности без повторов", () => {
    const neighbors = graphNeighbors(demoGraph, "portal");
    expect(neighbors).toContain("domain");
    expect(neighbors).toContain("edge-ip");
    expect(new Set(neighbors).size).toBe(neighbors.length);
  });

  it("фильтрует узлы и удаляет рёбра к скрытым узлам", () => {
    const result = filterGraph(demoGraph, new Set(["domain", "subdomain"]), "northstar");
    expect(result.nodes.every((node) => node.type === "domain" || node.type === "subdomain")).toBe(true);
    const ids = new Set(result.nodes.map((node) => node.id));
    expect(result.edges.every((edge) => ids.has(edge.source) && ids.has(edge.target))).toBe(true);
  });

  it("выбирает и снимает выделение узлов, поддерживая мультивыбор", () => {
    expect(updateSelection([], "portal", false)).toEqual(["portal"]);
    expect(updateSelection(["portal"], "domain", true)).toEqual(["portal", "domain"]);
    expect(updateSelection(["portal", "domain"], "portal", true)).toEqual(["domain"]);
    expect(updateSelection(["portal"], "", false)).toEqual([]);
  });

  it("связывает выделенные узлы с отношениями в обоих направлениях", () => {
    const result = connectedEdges(demoGraph, new Set(["portal"]));
    expect(result.some((edge) => edge.source === "portal" || edge.target === "portal")).toBe(true);
    expect(result.every((edge) => edge.source === "portal" || edge.target === "portal")).toBe(true);
  });
});

