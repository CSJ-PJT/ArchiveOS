export type AppRoute = "overview" | "workflows" | "knowledge" | "history" | "settings";

export type NavigationItem = {
  id: AppRoute;
  label: string;
  shortLabel: string;
  description: string;
};

export const navigationItems: NavigationItem[] = [
  {
    id: "overview",
    label: "Overview",
    shortLabel: "Home",
    description: "5-second PM operations summary",
  },
  {
    id: "workflows",
    label: "Workflows",
    shortLabel: "Flow",
    description: "Queue, agents, pipeline, and PM decisions",
  },
  {
    id: "knowledge",
    label: "Knowledge",
    shortLabel: "Memory",
    description: "Operational memory, graph, RAG, and Obsidian",
  },
  {
    id: "history",
    label: "History",
    shortLabel: "Logs",
    description: "Timeline, decisions, commands, errors, and KPI history",
  },
  {
    id: "settings",
    label: "Settings",
    shortLabel: "Config",
    description: "Runtime, integrations, security, theme, and build status",
  },
];
