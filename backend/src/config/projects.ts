export type ProjectConfig = {
  id: string;
  name: string;
  path: string;
  repo: string;
};

export const projects: ProjectConfig[] = [
  {
    id: "archiveos",
    name: "ArchiveOS",
    path: process.env.ARCHIVEOS_PROJECT_PATH ?? process.cwd(),
    repo: "CSJ-PJT/ArchiveOS",
  },
];

export function findProject(projectId: string) {
  return projects.find((project) => project.id === projectId);
}
