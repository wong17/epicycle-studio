import type { Project } from './project-schema';

/** Offer only a newer automatic copy with actual document changes. */
export function needsRecovery(draft: Project, saved: Project | undefined): boolean {
  if (!saved) return true;
  if (draft.updatedAt <= saved.updatedAt) return false;
  const content = (project: Project) =>
    JSON.stringify({
      name: project.name,
      dimension: project.dimension,
      source: project.source,
      analysis: project.analysis,
      appearance: project.appearance,
      playback: project.playback,
      view: project.view,
    });
  return content(draft) !== content(saved);
}
