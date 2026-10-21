export type EntityType =
  | "organization" | "domain" | "subdomain" | "ip" | "dns" | "certificate"
  | "person" | "technology" | "application" | "repository" | "finding"
  | "vulnerability" | "asset";

export type RelationKind =
  | "resolves_to" | "belongs_to" | "hosted_on" | "uses_technology"
  | "discovered_from" | "shares_certificate" | "linked_to"
  | "evidence_supports" | "potentially_related";

export type EvidenceStatus = "confirmed" | "hypothesis" | "unknown";

export interface GraphNode {
  id: string;
  type: EntityType;
  label: string;
  attributes: Record<string, string>;
  confidence: number;
  source: string;
  discoveredAt: string;
  status: EvidenceStatus;
  pinned?: boolean;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation: RelationKind;
  confidence: number;
  evidence: string;
  status: EvidenceStatus;
  discoveredAt: string;
}

export interface IntelligenceGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  demo: true;
  updatedAt: string;
}

export const TYPE_LABELS: Record<EntityType, string> = {
  organization: "Организация", domain: "Домен", subdomain: "Поддомен",
  ip: "IP-адрес", dns: "DNS-запись", certificate: "Сертификат",
  person: "Идентификатор", technology: "Технология", application: "Веб-приложение",
  repository: "Репозиторий", finding: "Находка", vulnerability: "Уязвимость", asset: "Актив",
};

export const RELATION_LABELS: Record<RelationKind, string> = {
  resolves_to: "указывает на", belongs_to: "принадлежит", hosted_on: "размещён на",
  uses_technology: "использует", discovered_from: "обнаружено через",
  shares_certificate: "общий сертификат", linked_to: "связан с",
  evidence_supports: "подтверждается", potentially_related: "возможно связан с",
};

const node = (
  id: string, type: EntityType, label: string, source: string,
  confidence = 0.92, status: EvidenceStatus = "confirmed", extra: Record<string, string> = {},
): GraphNode => ({
  id, type, label, source, confidence, status,
  discoveredAt: "2026-10-21T08:42:00Z",
  attributes: { "Контур": "Демонстрационный", "Среда": "Публичная поверхность", ...extra },
});

const edge = (
  id: string, source: string, target: string, relation: RelationKind,
  evidence: string, confidence = 0.9, status: EvidenceStatus = "confirmed",
): GraphEdge => ({ id, source, target, relation, evidence, confidence, status, discoveredAt: "2026-10-21T08:42:00Z" });

// Safe, fictional sample data. All results in this graph are explicitly marked Demo.
export const demoGraph: IntelligenceGraph = {
  demo: true,
  updatedAt: "2026-10-21T08:42:00Z",
  nodes: [
    node("org", "organization", "Northstar Research · Demo", "Демонстрационный набор", .99, "confirmed", { "Идентификатор": "ORG-DEMO-01", "Отрасль": "Исследования" }),
    node("domain", "domain", "northstar.example", "Пример в документации", .99, "confirmed", { "Регистратор": "Example Registrar", "Статус": "Учебный" }),
    node("portal", "subdomain", "portal.northstar.example", "Пассивный DNS · Demo", .96, "confirmed", { "Наблюдение": "A-запись" }),
    node("status", "subdomain", "status.northstar.example", "Пассивный DNS · Demo", .96, "confirmed"),
    node("api", "subdomain", "api.northstar.example", "Пассивный DNS · Demo", .94, "confirmed"),
    node("edge-ip", "ip", "203.0.113.24", "Документационный диапазон RFC 5737", .99, "confirmed", { "ASN": "AS64500 · Demo", "Сеть": "203.0.113.0/24" }),
    node("api-ip", "ip", "198.51.100.18", "Документационный диапазон RFC 5737", .99, "confirmed", { "ASN": "AS64501 · Demo" }),
    node("dns-a", "dns", "A · 203.0.113.24", "Пассивный DNS · Demo", .96, "confirmed", { "Тип записи": "A", "TTL": "300" }),
    node("dns-mx", "dns", "MX · mail.northstar.example", "Пассивный DNS · Demo", .94, "confirmed", { "Тип записи": "MX", "Приоритет": "10" }),
    node("cert", "certificate", "Сертификат · 7F:2A:91", "Certificate Transparency · Demo", .98, "confirmed", { "Издатель": "Example CA", "Срок": "2027-04-18" }),
    node("tech-nginx", "technology", "Nginx 1.26 · Demo", "Пассивный fingerprint", .83, "hypothesis", { "Признак": "HTTP-заголовок" }),
    node("tech-next", "technology", "Next.js · Demo", "Публичная страница · Demo", .82, "hypothesis"),
    node("app-portal", "application", "Портал партнёров", "Синтетическое наблюдение", .91, "confirmed", { "HTTP": "HTTPS", "Состояние": "Наблюдается" }),
    node("app-status", "application", "Страница состояния", "Синтетическое наблюдение", .9, "confirmed"),
    node("repo", "repository", "northstar/public-docs", "Публичный пример · Demo", .99, "confirmed", { "Ветка": "main", "Видимость": "Публичный" }),
    node("person", "person", "security-contact@northstar.example", "Публичная контактная запись · Demo", .99, "confirmed", { "Тип": "Контакт безопасности" }),
    node("asset-mail", "asset", "Почтовый шлюз · Demo", "Синтетическая инвентаризация", .9, "confirmed"),
    node("finding-header", "finding", "Отсутствует заголовок CSP", "Демо-скан конфигурации", .78, "hypothesis", { "Приоритет": "Низкий", "Проверка": "Требуется подтверждение" }),
    node("finding-tls", "finding", "TLS: современная конфигурация", "Демо-проверка сертификата", .93, "confirmed", { "Приоритет": "Информационный" }),
    node("vuln-demo", "vulnerability", "CVE-DEMO-2026-0042", "Синтетическая запись для обучения", .42, "unknown", { "Состояние": "Не подтверждено", "Приоритет": "Не назначен" }),
    node("repo-action", "finding", "Публичный workflow · Demo", "Публичный репозиторий · Demo", .79, "hypothesis", { "Наблюдение": "Настройка CI требует проверки" }),
    node("asset-dns", "asset", "DNS-зона · Demo", "Синтетическая инвентаризация", .94, "confirmed"),
  ],
  edges: [
    edge("e-org-domain", "org", "domain", "belongs_to", "Публичная зона · Demo", .99),
    edge("e-domain-portal", "domain", "portal", "linked_to", "Поддомен из синтетической зоны", .96),
    edge("e-domain-status", "domain", "status", "linked_to", "Поддомен из синтетической зоны", .96),
    edge("e-domain-api", "domain", "api", "linked_to", "Поддомен из синтетической зоны", .95),
    edge("e-portal-ip", "portal", "edge-ip", "resolves_to", "Синтетическое DNS-наблюдение", .98),
    edge("e-api-ip", "api", "api-ip", "resolves_to", "Синтетическое DNS-наблюдение", .98),
    edge("e-dns-a", "portal", "dns-a", "discovered_from", "A-запись · Demo", .98),
    edge("e-domain-mx", "domain", "dns-mx", "discovered_from", "MX-запись · Demo", .94),
    edge("e-cert-portal", "cert", "portal", "shares_certificate", "SAN сертификата · Demo", .98),
    edge("e-cert-status", "cert", "status", "shares_certificate", "SAN сертификата · Demo", .98),
    edge("e-cert-api", "cert", "api", "shares_certificate", "SAN сертификата · Demo", .97),
    edge("e-portal-app", "portal", "app-portal", "hosted_on", "Демонстрационное сопоставление", .94),
    edge("e-status-app", "status", "app-status", "hosted_on", "Демонстрационное сопоставление", .91),
    edge("e-app-nginx", "app-portal", "tech-nginx", "uses_technology", "HTTP-отпечаток · гипотеза", .81, "hypothesis"),
    edge("e-app-next", "app-portal", "tech-next", "uses_technology", "Признак клиентской сборки · гипотеза", .78, "hypothesis"),
    edge("e-org-repo", "org", "repo", "belongs_to", "Публичный пример", .97),
    edge("e-repo-action", "repo", "repo-action", "evidence_supports", "Workflow из синтетического примера", .8, "hypothesis"),
    edge("e-org-person", "org", "person", "linked_to", "Публичная контактная запись · Demo", .96),
    edge("e-org-mail", "org", "asset-mail", "belongs_to", "Синтетическая инвентаризация", .9),
    edge("e-domain-asset", "domain", "asset-dns", "belongs_to", "Зона организации · Demo", .94),
    edge("e-finding-app", "finding-header", "app-portal", "potentially_related", "Результат учебной проверки, требует ручной валидации", .72, "hypothesis"),
    edge("e-tls-cert", "finding-tls", "cert", "evidence_supports", "Проверка параметров сертификата · Demo", .93),
    edge("e-vuln-nginx", "vuln-demo", "tech-nginx", "potentially_related", "Сопоставление версии условное, не подтверждено", .31, "unknown"),
    edge("e-mail-mx", "asset-mail", "dns-mx", "linked_to", "Почтовый MX · Demo", .9),
  ],
};

export const ENTITY_TYPES = Object.keys(TYPE_LABELS) as EntityType[];

