"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, ArrowDownToLine, ArrowLeftRight, Bell, BookOpen, Box, ChevronDown,
  ChevronLeft, ChevronRight, ChevronsUpDown, CircleHelp, Command, Crosshair, Database,
  Download, FileJson, Filter, Focus, GitBranch, Globe2, Grid2X2, History, Layers3, LockKeyhole,
  Maximize, Minus, MoreHorizontal, Network, Plus, Radar, RotateCcw, RotateCw, Search, Settings2,
  Shield, ShieldAlert, SlidersHorizontal, Sparkles, Target, Trash2, Upload, UserRound, Waypoints,
  X,
} from "lucide-react";
import { GraphCanvas, GRAPH_MODES, type GraphCanvasHandle, type GraphMode } from "@/components/graph-canvas";
import { demoGraph, ENTITY_TYPES, RELATION_LABELS, TYPE_LABELS, type EntityType, type GraphEdge, type GraphNode, type IntelligenceGraph } from "@/lib/graph";
import { filterGraph, graphNeighbors, updateSelection } from "@/lib/graph-ops";

type NavId = "overview" | "graph" | "assets" | "recon" | "surface" | "findings" | "threats" | "purple" | "reports" | "settings";
interface Investigation { id: string; title: string; createdAt: string; nodeIds: string[]; notes: string; }
interface WorkspaceSnapshot { positions: Record<string, { x: number; y: number }>; selectedIds: string[]; }
interface ActivityEntry { id: string; at: string; title: string; detail: string; }
const NAV: { id: NavId; label: string; icon: typeof Grid2X2 }[] = [
  { id: "overview", label: "Обзор", icon: Grid2X2 }, { id: "graph", label: "Исследователь графа", icon: Network },
  { id: "assets", label: "Активы", icon: Box }, { id: "recon", label: "Разведка и OSINT", icon: Radar },
  { id: "surface", label: "Поверхность атаки", icon: Globe2 }, { id: "findings", label: "Находки", icon: ShieldAlert },
  { id: "threats", label: "Разведданные об угрозах", icon: Activity }, { id: "purple", label: "Purple Team", icon: Target },
  { id: "reports", label: "Отчёты", icon: FileJson }, { id: "settings", label: "Настройки", icon: Settings2 },
];
const NAV_TYPES: Partial<Record<NavId, EntityType[]>> = {
  assets: ["asset", "organization", "domain", "subdomain", "ip"],
  recon: ["domain", "subdomain", "ip", "dns", "certificate", "repository", "technology"],
  surface: ["organization", "domain", "subdomain", "ip", "dns", "certificate", "application", "asset"],
  findings: ["finding", "vulnerability", "asset", "application", "technology"],
  threats: ["finding", "vulnerability", "person", "repository", "technology"],
  purple: ["finding", "vulnerability", "asset", "application"],
};
const CONFIDENCE_LABEL = (value: number) => value >= .9 ? "Высокая" : value >= .65 ? "Средняя" : "Низкая";
const STATUS_LABEL = { confirmed: "Подтверждено", hypothesis: "Гипотеза", unknown: "Неизвестно" } as const;
let fallbackIdSequence = 0;
const createId = () => {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  fallbackIdSequence += 1;
  return `nightfall-${Date.now().toString(36)}-${fallbackIdSequence.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export default function Home() {
  const canvasRef = useRef<GraphCanvasHandle>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [graph, setGraph] = useState<IntelligenceGraph>(demoGraph);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<GraphMode>("force");
  const [showLabels, setShowLabels] = useState(true);
  const [visibleTypes, setVisibleTypes] = useState<Set<EntityType>>(() => new Set(ENTITY_TYPES));
  const [expandedNodeIds, setExpandedNodeIds] = useState<string[] | null>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [workspaceHistory, setWorkspaceHistory] = useState<WorkspaceSnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [activeNav, setActiveNav] = useState<NavId>("graph");
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [activeInvestigation, setActiveInvestigation] = useState("");
  const [modal, setModal] = useState<"investigation" | "commands" | "export" | null>(null);
  const [modalTitle, setModalTitle] = useState("");
  const [panel, setPanel] = useState<"notifications" | "profile" | "organization" | null>(null);
  const [toast, setToast] = useState("");
  const [ready, setReady] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(true);
  const [dockTab, setDockTab] = useState<"relations" | "activity" | "data">("relations");
  const [activity, setActivity] = useState<ActivityEntry[]>([{ id: "demo-entry", at: "2026-10-21T08:42:00Z", title: "Загружен демонстрационный граф", detail: "22 синтетические сущности · Demo" }]);
  const [inspectorMobileOpen, setInspectorMobileOpen] = useState(false);
  const [investigationNotes, setInvestigationNotes] = useState("");
  const [includeConnections, setIncludeConnections] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("nightfall-workspace-v1");
      if (saved) {
        const data = JSON.parse(saved) as { investigations?: Investigation[]; active?: string; positions?: Record<string, { x: number; y: number }>; graph?: IntelligenceGraph };
        if (Array.isArray(data.investigations)) setInvestigations(data.investigations);
        if (typeof data.active === "string") setActiveInvestigation(data.active);
        if (data.positions && typeof data.positions === "object") setPositions(data.positions);
        if (data.graph?.demo === true && Array.isArray(data.graph.nodes) && Array.isArray(data.graph.edges)) setGraph(data.graph);
      }
    } catch { setToast("Локальное состояние повреждено. Загружен демонстрационный набор данных."); }
    const timer = window.setTimeout(() => setReady(true), 260);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    try { localStorage.setItem("nightfall-workspace-v1", JSON.stringify({ investigations, active: activeInvestigation, positions, graph })); }
    catch { /* Private browsing can disable localStorage; the current session still works. */ }
  }, [investigations, activeInvestigation, positions, graph]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const activeCase = investigations.find((item) => item.id === activeInvestigation) ?? null;
  const selectedNodes = useMemo(() => graph.nodes.filter((node) => selectedIds.includes(node.id)), [graph.nodes, selectedIds]);
  const filtered = useMemo(() => {
    const result = filterGraph(graph, visibleTypes, query);
    if (!expandedNodeIds) return result;
    const visible = new Set(result.nodes.filter((node) => expandedNodeIds.includes(node.id)).map((node) => node.id));
    return { nodes: result.nodes.filter((node) => visible.has(node.id)), edges: result.edges.filter((edge) => visible.has(edge.source) && visible.has(edge.target)) };
  }, [graph, visibleTypes, query, expandedNodeIds]);
  const visibleNodeIds = useMemo(() => expandedNodeIds ? new Set(expandedNodeIds) : undefined, [expandedNodeIds]);
  const connected = useMemo(() => selectedIds.flatMap((id) => graphNeighbors(graph, id)).filter((id, index, list) => list.indexOf(id) === index), [graph, selectedIds]);
  const matchingCount = filtered.nodes.length;

  const showToast = useCallback((message: string) => setToast(message), []);
  const logActivity = useCallback((title: string, detail: string) => {
    setActivity((items) => [{ id: createId(), at: new Date().toISOString(), title, detail }, ...items].slice(0, 20));
  }, []);
  const rememberState = useCallback((snapshot: WorkspaceSnapshot) => {
    const base = historyIndex >= 0 ? workspaceHistory.slice(0, historyIndex + 1) : [{ positions, selectedIds }];
    const nextHistory = [...base, snapshot].slice(-30);
    setWorkspaceHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
  }, [historyIndex, positions, selectedIds, workspaceHistory]);
  const selectNode = useCallback((id: string, additive: boolean) => {
    const next = updateSelection(selectedIds, id, additive);
    if (JSON.stringify(selectedIds) !== JSON.stringify(next)) {
      rememberState({ positions, selectedIds: next });
      if (id) logActivity("Изменено выделение", `${next.length} сущностей в фокусе`);
    }
    setSelectedIds(next);
    if (id && window.matchMedia("(max-width: 740px)").matches) setInspectorMobileOpen(true);
  }, [logActivity, positions, rememberState, selectedIds]);
  const updatePositions = useCallback((next: Record<string, { x: number; y: number }>) => {
    rememberState({ positions: next, selectedIds });
    setPositions(next);
    logActivity("Изменена раскладка графа", "Позиции сохранены локально");
  }, [logActivity, positions, rememberState, selectedIds]);
  const togglePin = useCallback((id: string) => {
    setGraph((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === id ? { ...node, pinned: !node.pinned } : node) }));
    logActivity("Изменено закрепление узла", graph.nodes.find((node) => node.id === id)?.label ?? id);
    showToast("Закрепление узла изменено");
  }, [graph.nodes, logActivity, showToast]);

  const undo = () => {
    if (historyIndex <= 0) { showToast("История изменений пуста"); return; }
    const previous = workspaceHistory[historyIndex - 1]; setPositions(previous.positions); setSelectedIds(previous.selectedIds); setHistoryIndex((index) => index - 1); showToast("Последнее изменение отменено"); logActivity("Отмена изменения", "Восстановлено предыдущее состояние полотна");
  };
  const redo = () => {
    const next = workspaceHistory[historyIndex + 1];
    if (!next) { showToast("Нет изменений для повтора"); return; }
    setPositions(next.positions); setSelectedIds(next.selectedIds); setHistoryIndex((index) => index + 1); showToast("Изменение восстановлено"); logActivity("Повтор изменения", "Восстановлено следующее состояние полотна");
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "/" && !["INPUT", "TEXTAREA"].includes((event.target as HTMLElement)?.tagName)) { event.preventDefault(); searchRef.current?.focus(); }
      if (event.key === "Escape") { setSelectedIds([]); setModal(null); setPanel(null); searchRef.current?.blur(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setModal("commands"); }
      if (event.key.toLowerCase() === "f" && !event.ctrlKey && !event.metaKey && !["INPUT", "TEXTAREA"].includes((event.target as HTMLElement)?.tagName)) canvasRef.current?.fit();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const selectNav = (id: NavId) => {
    setActiveNav(id);
    setExpandedNodeIds(null);
    if (NAV_TYPES[id]) setVisibleTypes(new Set(NAV_TYPES[id]));
    else if (id === "graph" || id === "overview") setVisibleTypes(new Set(ENTITY_TYPES));
    if (id === "reports") setModal("export");
    if (id === "settings") setToast("Настройки графа находятся в панели фильтров и инструментов");
  };

  const toggleType = (type: EntityType) => { setExpandedNodeIds(null); setVisibleTypes((current) => {
    const next = new Set(current); next.has(type) ? next.delete(type) : next.add(type); return next;
  }); };

  const createInvestigation = () => {
    const title = modalTitle.trim();
    if (!title) { showToast("Введите название расследования"); return; }
    const item = { id: createId(), title, createdAt: new Date().toISOString(), nodeIds: [...selectedIds], notes: "" };
    setInvestigations((current) => [item, ...current]); setActiveInvestigation(item.id); setInvestigationNotes(""); setModal(null); setModalTitle("");
    logActivity("Создано расследование", title);
    showToast("Рабочая область расследования создана");
  };

  const saveNotes = (value: string) => {
    setInvestigationNotes(value);
    if (activeInvestigation) setInvestigations((current) => current.map((item) => item.id === activeInvestigation ? { ...item, notes: value } : item));
  };
  useEffect(() => { setInvestigationNotes(activeCase?.notes ?? ""); }, [activeCase?.id]);

  const addSelectionToCase = () => {
    if (!selectedIds.length) { showToast("Сначала выберите сущность на графе"); return; }
    if (!activeInvestigation) { setModal("investigation"); setModalTitle("Расследование цифровой поверхности"); return; }
    setInvestigations((current) => current.map((item) => item.id === activeInvestigation ? { ...item, nodeIds: [...new Set([...item.nodeIds, ...selectedIds])] } : item));
    logActivity("Добавлены сущности в расследование", `${selectedIds.length} сущностей`);
    showToast(`Добавлено сущностей: ${selectedIds.length}`);
  };

  const toggleNeighborExpansion = () => {
    if (!selectedIds.length) { showToast("Выберите узел, чтобы раскрыть соседей"); return; }
    const ids = new Set([...(expandedNodeIds ?? []), ...selectedIds, ...connected]);
    setExpandedNodeIds([...ids]);
    showToast(`Связи раскрыты: ${connected.length} соседних сущностей`);
  };

  const expandNode = (id: string) => {
    const neighbors = graphNeighbors(graph, id);
    setExpandedNodeIds((current) => [...new Set([...(current ?? []), id, ...neighbors])]);
    logActivity("Раскрыты связи сущности", `${id} · ${neighbors.length} соседей`);
    showToast(`Раскрыто соседних сущностей: ${neighbors.length}`);
  };

  const collapseBranches = () => {
    if (!selectedIds.length) { setSelectedIds([]); showToast("Выделение очищено"); return; }
    setExpandedNodeIds([...selectedIds]);
    showToast("Ветви свёрнуты до выбранных типов сущностей");
  };

  const exportJson = (includeEdges: boolean) => {
    const ids = new Set(selectedIds);
    const nodeIds = includeEdges && ids.size ? new Set([...ids, ...connected]) : ids;
    const outputNodes = ids.size ? graph.nodes.filter((node) => nodeIds.has(node.id)) : filtered.nodes;
    const outputIds = new Set(outputNodes.map((node) => node.id));
    const outputEdges = includeEdges ? graph.edges.filter((edge) => outputIds.has(edge.source) && outputIds.has(edge.target)) : [];
    const payload = { name: activeCase?.title ?? "NIGHTFALL Graph Export", exportedAt: new Date().toISOString(), demo: true, nodes: outputNodes, edges: outputEdges };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "nightfall-investigation-demo.json"; link.click(); URL.revokeObjectURL(url);
    logActivity("Выгружен граф", `${outputNodes.length} сущностей · JSON`);
    setModal(null); showToast(`Экспортировано сущностей: ${outputNodes.length}`);
  };

  const importFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 2_000_000) { showToast("Размер JSON не должен превышать 2 МБ"); return; }
    try {
      const data = JSON.parse(await file.text()) as Partial<IntelligenceGraph>;
      if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) throw new Error("Файл должен содержать массивы nodes и edges");
      const nodeCandidates = data.nodes.filter((item): item is GraphNode => Boolean(item && typeof item.id === "string" && typeof item.label === "string" && ENTITY_TYPES.includes(item.type as EntityType)));
      const nodes: GraphNode[] = nodeCandidates.map((item) => ({
        id: item.id.slice(0, 160), type: item.type, label: item.label.slice(0, 300),
        attributes: Object.fromEntries(Object.entries(item.attributes && typeof item.attributes === "object" ? item.attributes : {}).slice(0, 30).map(([key, value]) => [String(key).slice(0, 80), String(value).slice(0, 500)])),
        confidence: Number.isFinite(item.confidence) ? Math.max(0, Math.min(1, item.confidence)) : 0.5,
        source: typeof item.source === "string" ? item.source.slice(0, 300) : "Импортированный источник",
        discoveredAt: typeof item.discoveredAt === "string" ? item.discoveredAt : new Date().toISOString(),
        status: ["confirmed", "hypothesis", "unknown"].includes(item.status) ? item.status : "unknown",
        pinned: Boolean(item.pinned),
      }));
      const ids = new Set(nodes.map((node) => node.id));
      const edgeCandidates = (data.edges as GraphEdge[]).filter((item) => item && typeof item.id === "string" && ids.has(item.source) && ids.has(item.target) && Object.hasOwn(RELATION_LABELS, item.relation));
      const edges: GraphEdge[] = edgeCandidates.map((item) => ({
        id: item.id.slice(0, 160), source: item.source, target: item.target, relation: item.relation,
        confidence: Number.isFinite(item.confidence) ? Math.max(0, Math.min(1, item.confidence)) : 0.5,
        evidence: typeof item.evidence === "string" ? item.evidence.slice(0, 800) : "Основание не указано",
        status: ["confirmed", "hypothesis", "unknown"].includes(item.status) ? item.status : "unknown",
        discoveredAt: typeof item.discoveredAt === "string" ? item.discoveredAt : new Date().toISOString(),
      }));
      if (!nodes.length) throw new Error("В файле нет подходящих сущностей");
      setGraph({ nodes, edges, demo: true, updatedAt: new Date().toISOString() }); setVisibleTypes(new Set(ENTITY_TYPES)); setSelectedIds([]);
      logActivity("Импортирован граф", `${nodes.length} сущностей · локальный JSON`);
      showToast(`Импортировано сущностей: ${nodes.length}; набор помечен как Demo`);
    } catch (error) { showToast(error instanceof Error ? `Не удалось прочитать JSON: ${error.message}` : "Не удалось прочитать JSON"); logActivity("Ошибка импорта графа", error instanceof Error ? error.message : "Неизвестная ошибка"); }
    if (fileRef.current) fileRef.current.value = "";
  };

  const clearWorkspace = () => {
    if (!activeInvestigation) { showToast("Нет активного расследования"); return; }
    setInvestigations((current) => current.filter((item) => item.id !== activeInvestigation)); setActiveInvestigation(""); showToast("Расследование удалено из этого браузера");
  };

  return (
    <main className="nightfall-shell">
      <aside className="nav-rail">
        <div className="brand-lockup"><div className="brand-mark"><span /></div><div><div className="brand-name">NIGHTFALL</div><div className="brand-edition">ENTERPRISE CYBER RANGE</div></div></div>
        <button className="workspace-switch" aria-label="Организация и проект" onClick={() => setPanel(panel === "organization" ? null : "organization")}><div className="workspace-avatar">N</div><div className="workspace-copy"><strong>Northstar Research</strong><span>Рабочее пространство · Demo</span></div><ChevronsUpDown size={15} /></button>
        <div className="nav-caption">РАБОЧАЯ СРЕДА</div>
        <nav className="primary-nav" aria-label="Основная навигация">
          {NAV.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${activeNav === id ? "active" : ""}`} onClick={() => selectNav(id)}><Icon size={17} strokeWidth={1.7} /><span>{label}</span>{id === "findings" && <i className="nav-count">3</i>}</button>)}
        </nav>
        <div className="nav-bottom">
          <div className="access-card"><div className="access-icon"><LockKeyhole size={15} /></div><div><strong>Пассивный режим</strong><span>Только разрешённые данные</span></div><span className="access-dot" /></div>
          <button className="nav-footer" onClick={() => showToast("Документация доступна в README проекта")}><CircleHelp size={16} /> Справочный центр <span>?</span></button>
          <div className="user-mini"><div className="user-avatar"><UserRound size={17} /></div><div><strong>Аналитик</strong><span>Уровень доступа · Demo</span></div><MoreHorizontal size={18} /></div>
        </div>
      </aside>

      <section className="main-column">
        <header className="command-bar">
          <div className="breadcrumbs"><span>Рабочая область</span><ChevronRight size={13} /><strong>{NAV.find((item) => item.id === activeNav)?.label ?? "Исследователь графа"}</strong></div>
          <div className="command-right">
            <label className="global-search"><Search size={15} /><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск сущностей и атрибутов" aria-label="Поиск по графу" /><kbd>/</kbd></label>
            <button className={`icon-button ${panel === "notifications" ? "pressed" : ""}`} aria-label="Уведомления" onClick={() => setPanel(panel === "notifications" ? null : "notifications")}><Bell size={17} /><i className="notification-dot" /></button>
            <button className="profile-button" onClick={() => setPanel(panel === "profile" ? null : "profile")}><span className="user-avatar small"><UserRound size={15} /></span><span>Аналитик</span><ChevronDown size={13} /></button>
          </div>
          {panel && <div className="top-popover">{panel === "notifications" ? <><strong>Центр уведомлений</strong><p>Новых оповещений нет.</p><span className="muted-note">Данные рабочего пространства помечены как Demo.</span></> : panel === "profile" ? <><strong>Профиль аналитика</strong><p>Локальный режим · без учётной записи</p><button onClick={() => setPanel(null)}>Закрыть</button></> : <><strong>Организация и проект</strong><p>Northstar Research · Demo</p><span className="muted-note">Активный проект: инфраструктурная карта. Другие проекты в этом прототипе не подключены.</span><button onClick={() => setPanel(null)}>Закрыть</button></>}</div>}
        </header>

        <div className="workspace-heading">
          <div><div className="eyebrow"><span className="status-lamp" /> РАССЛЕДОВАНИЕ / ГРАФ СВЯЗЕЙ <span className="demo-pill">DEMO DATA</span></div><h1>Graph Explorer</h1><p>Исследуйте сущности и основания связей в контролируемом демонстрационном контуре.</p></div>
          <div className="heading-actions"><button className="button-secondary" onClick={() => fileRef.current?.click()}><Upload size={15} /> Импорт JSON</button><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(event) => importFile(event.target.files?.[0])} /><button className="button-primary" onClick={() => { setModal("investigation"); setModalTitle(""); }}><Plus size={16} /> Новое расследование</button></div>
        </div>

        <section className="graph-workspace" aria-label="Рабочая область исследования графа">
          <div className="graph-topline">
            <div className="case-context"><span className="case-icon"><GitBranch size={15} /></span><div><strong>{activeCase?.title ?? "Инфраструктурная карта"}</strong><span>{activeCase ? `Обновлено ${new Date(activeCase.createdAt).toLocaleDateString("ru-RU")}` : "Демонстрационный набор · локальное состояние"}</span></div><ChevronDown size={14} /></div>
            <div className="graph-meta"><span><i className="green-dot" /> {matchingCount} сущностей</span><span>{filtered.edges.length} связей</span><span className="stream-status"><span /> DEMO</span></div>
          </div>

          <div className="graph-body">
            <section className="canvas-column">
              <div className="canvas-tools">
                <div className="mode-tabs" role="tablist" aria-label="Режим графа">{GRAPH_MODES.map((item) => <button key={item.id} role="tab" aria-selected={mode === item.id} className={mode === item.id ? "selected" : ""} onClick={() => setMode(item.id)}>{item.label}</button>)}</div>
              <div className="canvas-actions"><button title="Отменить изменение (Ctrl+Z)" aria-label="Отменить изменение" onClick={undo}><RotateCcw size={15} /></button><button title="Повторить изменение (Ctrl+Shift+Z)" aria-label="Повторить изменение" onClick={redo}><RotateCw size={15} /></button><span className="tool-separator" /><button title="Показать весь граф (F)" aria-label="Показать весь граф" onClick={() => canvasRef.current?.fit()}><Focus size={15} /></button><button title="Экспорт PNG" aria-label="Экспорт графа в PNG" onClick={() => canvasRef.current?.exportPng()}><Download size={15} /></button><button title={showLabels ? "Скрыть подписи связей" : "Показать подписи связей"} aria-label="Переключить подписи связей" className={showLabels ? "tool-on" : ""} onClick={() => setShowLabels((value) => !value)}><ArrowLeftRight size={15} /></button><button title="Добавить выбранное в расследование" aria-label="Добавить выбранные сущности" onClick={addSelectionToCase}><Plus size={16} /></button><button className="mobile-inspector-toggle" title="Открыть инспектор" aria-label="Открыть инспектор сущности" onClick={() => setInspectorMobileOpen((value) => !value)}><UserRound size={14} /></button></div>
              </div>
              <div className="canvas-area">
                {!ready ? <div className="graph-loading"><span className="loading-ring" /><strong>Подготовка графа</strong><span>Загрузка локального демонстрационного набора</span></div> : matchingCount === 0 ? <div className="empty-overlay"><Network size={25} /><strong>Нет сущностей для отображения</strong><span>Измените поиск или верните фильтры.</span><button onClick={() => { setQuery(""); setVisibleTypes(new Set(ENTITY_TYPES)); setExpandedNodeIds(null); }}>Сбросить поиск и фильтры</button></div> : <GraphCanvas ref={canvasRef} graph={graph} mode={mode} selectedIds={selectedIds} query={query} visibleTypes={visibleTypes} visibleNodeIds={visibleNodeIds} showLabels={showLabels} positions={positions} onSelect={selectNode} onPositions={updatePositions} onLayout={setPositions} onTogglePin={togglePin} onExpand={expandNode} />}
                <div className="canvas-vignette" />
                <div className="canvas-tag"><span className="tiny-pulse" /> ДЕМО-КОНТУР <span className="tag-divider" /> ПАССИВНЫЙ РЕЖИМ</div>
                <div className="map-controls"><button onClick={() => canvasRef.current?.zoom(.14)} aria-label="Увеличить масштаб"><Plus size={15} /></button><span>{ready ? "100%" : "—"}</span><button onClick={() => canvasRef.current?.zoom(-.14)} aria-label="Уменьшить масштаб"><Minus size={15} /></button><button onClick={() => canvasRef.current?.fit()} aria-label="Вписать граф в экран"><Maximize size={14} /></button></div>
              <div className="minimap" aria-label="Мини-карта графа"><div className="minimap-viewport" />{ready && minimapPoints(graph.nodes, positions).map((point) => <i key={point.id} style={{ left: `${point.x.toFixed(1)}%`, top: `${point.y.toFixed(1)}%`, backgroundColor: colorsFor(point.type) }} />)}</div>
                <div className="canvas-coordinates">Узел выбран: {selectedIds.length ? selectedIds.length : "нет"}<span /> Масштаб: полотно интерактивно</div>
              </div>
              <div className="canvas-footer"><span><i className="legend-dot confirmed" /> Подтверждено</span><span><i className="legend-line hypothesis" /> Гипотеза</span><span><i className="legend-line unknown" /> Неизвестно</span><span className="footer-hint">Перемещение: перетащите полотно · Узел: щелчок · Мультивыбор: Shift + щелчок · Закрепить: правый щелчок</span></div>
            </section>

            <aside className={`inspector-panel ${inspectorMobileOpen ? "mobile-open" : ""}`}>
              <div className="inspector-head"><div><div className="section-overline">АНАЛИТИЧЕСКИЙ КОНТЕКСТ</div><h2>Инспектор</h2></div><button className="subtle-icon" onClick={() => { setSelectedIds([]); setInspectorMobileOpen(false); }} aria-label="Закрыть инспектор"><X size={15} /></button></div>
              {selectedNodes.length ? <>
                {selectedNodes.length > 1 && <div className="selection-count">Выбрано сущностей <strong>{selectedNodes.length}</strong></div>}
                {selectedNodes.slice(0, 3).map((node) => <EntityCard key={node.id} node={node} edges={graph.edges} nodes={graph.nodes} onCenter={() => canvasRef.current?.center(node.id)} onPin={() => togglePin(node.id)} />)}
                <div className="inspector-actions"><button className="button-primary full" onClick={addSelectionToCase}><Plus size={15} /> Добавить в расследование</button><button className="button-secondary full" onClick={toggleNeighborExpansion}><Waypoints size={15} /> Раскрыть соседей ({connected.length})</button><button className="button-quiet full" onClick={collapseBranches}><Layers3 size={15} /> Свернуть ветви</button></div>
                {activeCase && <div className="annotation-block"><label htmlFor="case-notes">Заметки расследования</label><textarea id="case-notes" value={investigationNotes} onChange={(event) => saveNotes(event.target.value)} placeholder="Зафиксируйте контекст, гипотезу или следующий шаг…" /><span>Сохранение автоматически · локально</span></div>}
              </> : <div className="inspector-empty"><div className="empty-glyph"><Crosshair size={23} /></div><strong>Выберите сущность</strong><p>Щёлкните узел на полотне, чтобы просмотреть атрибуты, происхождение данных и связи.</p><div className="empty-shortcuts"><span><kbd>Shift</kbd> + щелчок</span><span>мультивыбор</span></div><button onClick={toggleNeighborExpansion}>О раскрытии связей <ChevronRight size={14} /></button></div>}
              <div className="inspector-foot"><Shield size={13} /><span>Образец данных · не подтверждён для реальной среды</span></div>
            </aside>
          </div>
        </section>

        <section className="lower-dock">
          <div className="dock-tabs"><button className={`dock-tab ${dockTab === "relations" ? "active" : ""}`} onClick={() => setDockTab("relations")}><Waypoints size={14} /> Легенда связей</button><button className={`dock-tab ${dockTab === "activity" ? "active" : ""}`} onClick={() => setDockTab("activity")}><History size={14} /> Журнал активности <span className="small-count">{activity.length}</span></button><button className={`dock-tab ${dockTab === "data" ? "active" : ""}`} onClick={() => setDockTab("data")}><FileJson size={14} /> Данные и экспорт</button></div>
          <div className={`dock-content ${dockTab !== "relations" ? "expanded" : ""}`}>
            {dockTab === "relations" && <><div className="edge-legend">{Object.entries(RELATION_LABELS).slice(0, 6).map(([relation, label]) => <span key={relation}><i className={`legend-line ${relation === "potentially_related" ? "hypothesis" : ""}`} />{label}</span>)}</div><div className="dock-hint"><Database size={13} /> Источники и отношения в графе — синтетические примеры</div></>}
            {dockTab === "activity" && <div className="activity-feed">{activity.slice(0, 5).map((item) => <div key={item.id}><i className="activity-marker" /><span><strong>{item.title}</strong><small>{item.detail}</small></span><time>{new Date(item.at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</time></div>)}</div>}
            {dockTab === "data" && <div className="data-export-view"><span><Database size={14} /> Локальный граф Demo · {graph.nodes.length} сущностей · {graph.edges.length} связей</span><span>Серверное хранение не подключено</span><button className="button-secondary" onClick={() => setModal("export")}><Download size={13} /> Экспорт данных</button></div>}
          </div>
        </section>
        <footer className="status-bar"><span><i className="green-dot" /> Локальный граф загружен</span><span><span className="status-sep">/</span> Нет соединения с backend API</span><span className="status-right">Последняя синхронизация <strong>не выполнялась</strong><span className="status-sep">·</span> v0.1.0</span></footer>
      </section>

      <aside className="filter-rail">
        <div className="filter-header"><div><span className="section-overline">КОНТЕКСТ ГРАФА</span><h2>Фильтры</h2></div><button className="subtle-icon" onClick={() => setVisibleTypes(new Set(ENTITY_TYPES))} title="Сбросить фильтры"><RotateCcw size={14} /></button></div>
        <div className="filter-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти сущность" aria-label="Поиск сущности" /></div>
        <div className="filter-section-title"><span>ТИПЫ СУЩНОСТЕЙ</span><button onClick={() => setVisibleTypes(visibleTypes.size === ENTITY_TYPES.length ? new Set() : new Set(ENTITY_TYPES))}>{visibleTypes.size === ENTITY_TYPES.length ? "Снять" : "Все"}</button></div>
        <div className="type-filter-list">{ENTITY_TYPES.map((type) => <label key={type} className={`type-filter ${visibleTypes.has(type) ? "checked" : ""}`}><input type="checkbox" checked={visibleTypes.has(type)} onChange={() => toggleType(type)} /><span className="type-marker" style={{ "--marker": colorsFor(type) } as React.CSSProperties} /><span>{TYPE_LABELS[type]}</span><small>{graph.nodes.filter((node) => node.type === type).length}</small></label>)}</div>
        <div className="filter-separator" />
        <button className="filter-section-title collapsible" onClick={() => setLabelsOpen((value) => !value)}><span>ТИПЫ СВЯЗЕЙ</span><ChevronDown size={14} /></button>
        {labelsOpen && <div className="relation-list"><span><i className="relation-line solid" /> Подтверждённые</span><span><i className="relation-line dash" /> Аналитическая гипотеза</span><span><i className="relation-line dotted" /> Неизвестное отношение</span><label className="filter-toggle"><span>Показывать подписи</span><input type="checkbox" checked={showLabels} onChange={(event) => setShowLabels(event.target.checked)} /><i /></label></div>}
        <div className="filter-separator" />
        <div className="filter-section-title"><span>РАБОЧАЯ ОБЛАСТЬ</span><button onClick={() => setModal("investigation")}><Plus size={13} /> Новая</button></div>
        <div className="investigation-list">{investigations.length ? investigations.map((item) => <button key={item.id} className={`investigation-item ${activeInvestigation === item.id ? "active" : ""}`} onClick={() => setActiveInvestigation(item.id)}><span className="case-mini"><GitBranch size={13} /></span><span><strong>{item.title}</strong><small>{item.nodeIds.length} сущностей</small></span><ChevronRight size={13} /></button>) : <div className="no-investigations"><span>Нет сохранённых расследований</span><button onClick={() => setModal("investigation")}>Создать рабочую область</button></div>}</div>
        {activeCase && <button className="delete-case" onClick={clearWorkspace}><Trash2 size={13} /> Удалить активное расследование</button>}
        <div className="rail-bottom"><div className="privacy-note"><Shield size={14} /><div><strong>Конфиденциальность</strong><span>Рабочие данные остаются в браузере</span></div></div><button onClick={() => setModal("commands")} className="shortcut-help"><Command size={14} /> Команды <kbd>Ctrl K</kbd></button></div>
      </aside>

      {modal && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><div><span className="section-overline">NIGHTFALL WORKSPACE</span><h2 id="modal-title">{modal === "investigation" ? "Новое расследование" : modal === "commands" ? "Команды и сочетания" : "Экспорт графа"}</h2></div><button className="subtle-icon" aria-label="Закрыть" onClick={() => setModal(null)}><X size={16} /></button></div>
        {modal === "investigation" ? <div className="modal-content"><p>Создайте локальную рабочую область и добавляйте в неё выбранные сущности и заметки.</p><label className="field-label" htmlFor="investigation-name">Название</label><input id="investigation-name" className="text-field" autoFocus value={modalTitle} onChange={(event) => setModalTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") createInvestigation(); }} placeholder="Например, Проверка поверхности проекта" /><div className="modal-callout"><Shield size={15} /><span>Данные сохранятся только в локальном хранилище этого браузера.</span></div><div className="modal-actions"><button className="button-secondary" onClick={() => setModal(null)}>Отмена</button><button className="button-primary" onClick={createInvestigation}><Plus size={15} /> Создать</button></div></div> : modal === "export" ? <div className="modal-content"><p>Сформируйте выгрузку выбранных или отфильтрованных сущностей. Файл помечен как демонстрационный.</p><label className="include-option"><input type="checkbox" checked={includeConnections} onChange={(event) => setIncludeConnections(event.target.checked)} /><span><strong>Включить отношения и соседние узлы</strong><small>Сохранить связанный контекст выбранных сущностей</small></span></label><div className="export-summary"><span>Сущностей</span><strong>{selectedIds.length ? selectedIds.length : filtered.nodes.length}</strong><span>Набор</span><strong>Demo</strong></div><div className="modal-actions"><button className="button-secondary" onClick={() => setModal(null)}>Закрыть</button><button className="button-secondary" onClick={() => canvasRef.current?.exportPng()}><Download size={14} /> PNG</button><button className="button-primary" onClick={() => exportJson(includeConnections)}><ArrowDownToLine size={15} /> JSON</button></div></div> : <div className="modal-content"><div className="command-list"><div><kbd>/</kbd><span>Фокус на поиск сущностей</span></div><div><kbd>F</kbd><span>Вписать граф в полотно</span></div><div><kbd>Shift</kbd> + щелчок<span>Выбрать несколько узлов</span></div><div><kbd>Ctrl</kbd> + <kbd>Z</kbd><span>Отменить последнее перемещение</span></div><div><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd><span>Повторить перемещение</span></div><div><kbd>Esc</kbd><span>Снять выделение и закрыть окно</span></div><div><kbd>Правый щелчок</kbd><span>Закрепить или открепить узел</span></div></div><div className="modal-actions"><button className="button-primary" onClick={() => setModal(null)}>Понятно</button></div></div>}
      </section></div>}
      {toast && <div className="toast-message" role="status"><Sparkles size={15} />{toast}<button onClick={() => setToast("")} aria-label="Закрыть уведомление"><X size={14} /></button></div>}
    </main>
  );
}

const colorsFor = (type: EntityType) => ({ organization: "#a78bfa", domain: "#8b5cf6", subdomain: "#9b7cf7", ip: "#60a5fa", dns: "#38bdf8", certificate: "#67e8f9", person: "#f0abfc", technology: "#a5b4fc", application: "#818cf8", repository: "#c4b5fd", finding: "#fbbf24", vulnerability: "#f87171", asset: "#34d399" }[type]);
function minimapPoints(nodes: GraphNode[], positions: Record<string, { x: number; y: number }>) {
  const values = nodes.map((node, index) => {
    const point = positions[node.id] ?? { x: Math.cos(index * 2.4) * 110 + 180, y: Math.sin(index * 2.4) * 85 + 150 };
    return { id: node.id, type: node.type, ...point };
  });
  const xs = values.map((point) => point.x); const ys = values.map((point) => point.y);
  const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys);
  return values.map((point) => ({ ...point, x: 7 + ((point.x - minX) / Math.max(1, maxX - minX)) * 86, y: 9 + ((point.y - minY) / Math.max(1, maxY - minY)) * 80 }));
}

function EntityCard({ node, edges, nodes, onCenter, onPin }: { node: GraphNode; edges: GraphEdge[]; nodes: GraphNode[]; onCenter: () => void; onPin: () => void }) {
  const relations = edges.filter((edge) => edge.source === node.id || edge.target === node.id).slice(0, 4);
  const nodeById = new Map(nodes.map((item) => [item.id, item]));
  return <article className="entity-card"><div className="entity-title-row"><span className="entity-shape" style={{ "--entity": colorsFor(node.type) } as React.CSSProperties}><Network size={15} /></span><div><span className="entity-type">{TYPE_LABELS[node.type]}</span><h3>{node.label}</h3></div></div><div className="confidence-row"><span className={`evidence-state ${node.status}`}>{STATUS_LABEL[node.status]}</span><span className="confidence"><i style={{ width: `${node.confidence * 100}%` }} /><span>{Math.round(node.confidence * 100)}%</span></span></div><div className="entity-attributes">{Object.entries(node.attributes).slice(0, 4).map(([key, value]) => <div key={key}><span>{key}</span><strong>{value}</strong></div>)}<div><span>Источник</span><strong>{node.source}</strong></div><div><span>Обнаружено</span><strong>{new Date(node.discoveredAt).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" })}</strong></div><div><span>Достоверность</span><strong>{CONFIDENCE_LABEL(node.confidence)}</strong></div></div><div className="related-entities"><div className="related-title">СВЯЗАННЫЕ СУЩНОСТИ <span>{relations.length}</span></div>{relations.length ? relations.map((edge) => { const other = nodeById.get(edge.source === node.id ? edge.target : edge.source); if (!other) return null; return <div key={edge.id} className="related-row"><span className="related-node-dot" style={{ "--entity": colorsFor(other.type) } as React.CSSProperties} /><span className="related-label">{other.label}<small>{RELATION_LABELS[edge.relation]}</small></span><span className={`relation-confidence ${edge.status}`}>{Math.round(edge.confidence * 100)}%</span></div>; }) : <span className="muted-note">Связей нет</span>}</div><div className="entity-card-actions"><button onClick={onCenter}><Crosshair size={13} /> Центрировать</button><button onClick={onPin}>{node.pinned ? "Открепить" : "Закрепить"}</button></div></article>;
}

