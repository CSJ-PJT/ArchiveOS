export type IconName =
  | "overview"
  | "agents"
  | "workflow"
  | "knowledge"
  | "history"
  | "batch"
  | "rpa"
  | "settings"
  | "refresh"
  | "alert"
  | "activity"
  | "approval"
  | "health";

const paths: Record<IconName, string[]> = {
  overview: ["M3 3h7v7H3z", "M14 3h7v4h-7z", "M14 11h7v10h-7z", "M3 14h7v7H3z"],
  agents: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"],
  workflow: ["M4 6h16", "M4 12h10", "M4 18h7", "m17 15 3 3-3 3"],
  knowledge: ["M4 19.5A2.5 2.5 0 0 1 6.5 17H20", "M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"],
  history: ["M3 12a9 9 0 1 0 3-6.7L3 8", "M3 3v5h5", "M12 7v5l3 2"],
  batch: ["M4 5h16v4H4z", "M4 15h16v4H4z", "M8 9v6", "M16 9v6"],
  rpa: ["M12 2a3 3 0 0 0-3 3v1H7a4 4 0 0 0-4 4v6a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4v-6a4 4 0 0 0-4-4h-2V5a3 3 0 0 0-3-3z", "M8 13h.01", "M16 13h.01", "M9 17h6"],
  settings: ["M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z", "M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.04 1.56V20.3h-3v-.08a1.7 1.7 0 0 0-1.04-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7 15a1.7 1.7 0 0 0-1.56-1.04H5.3v-3h.14A1.7 1.7 0 0 0 7 9.92a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.12-2.12.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 11.7 4.7V4.6h3v.1a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.04h.14v3h-.14A1.7 1.7 0 0 0 19.4 15z"],
  refresh: ["M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5", "M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5"],
  alert: ["M10.3 3.7 2.3 18a2 2 0 0 0 1.74 3h15.92a2 2 0 0 0 1.74-3l-8-14.3a2 2 0 0 0-3.4 0z", "M12 9v4", "M12 17h.01"],
  activity: ["M3 12h4l2-6 4 12 2-6h6"],
  approval: ["M9 11l3 3L22 4", "M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"],
  health: ["M3 12h4l2-5 4 10 2-5h6"],
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg aria-hidden="true" className="ui-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name].map((path) => <path d={path} key={path} />)}
    </svg>
  );
}
