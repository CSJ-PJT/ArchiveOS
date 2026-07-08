import type { IconName } from "../components/shared/Icon";

export type AppRoute = "overview" | "agents" | "workflows" | "knowledge" | "history" | "batch" | "rpa" | "mcp" | "settings";

export type NavigationItem = {
  id: AppRoute;
  label: string;
  shortLabel: string;
  description: string;
  icon: IconName;
};

export const navigationItems: NavigationItem[] = [
  {
    id: "overview",
    label: "Overview",
    shortLabel: "Home",
    description: "5-second PM operations summary",
    icon: "overview",
  },
  {
    id: "agents",
    label: "Agents",
    shortLabel: "Agents",
    description: "Agent availability and current responsibility",
    icon: "agents",
  },
  {
    id: "workflows",
    label: "Workflows",
    shortLabel: "Flow",
    description: "Queue, agents, pipeline, and PM decisions",
    icon: "workflow",
  },
  {
    id: "knowledge",
    label: "Knowledge",
    shortLabel: "Memory",
    description: "Operational memory, graph, RAG, and Obsidian",
    icon: "knowledge",
  },
  {
    id: "history",
    label: "History",
    shortLabel: "Logs",
    description: "Timeline, decisions, commands, errors, and KPI history",
    icon: "history",
  },
  {
    id: "batch",
    label: "Batch",
    shortLabel: "Batch",
    description: "Spring Batch jobs and execution evidence",
    icon: "batch",
  },
  {
    id: "rpa",
    label: "RPA",
    shortLabel: "RPA",
    description: "Classified tasks and PM decision history",
    icon: "rpa",
  },
  {
    id: "mcp",
    label: "MCP Registry",
    shortLabel: "MCP",
    description: "Read-only tool capability and approval registry",
    icon: "activity",
  },
  {
    id: "settings",
    label: "Settings",
    shortLabel: "Config",
    description: "Runtime, integrations, security, theme, and build status",
    icon: "settings",
  },
];
