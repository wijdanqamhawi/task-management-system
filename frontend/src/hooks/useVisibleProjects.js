/*
 * Every project the signed-in user can see (up to the API's page cap of 100).
 * For a Manager that is exactly the projects they belong to, which is what the UI needs to
 * decide where to offer manager-only controls. Admin sees all; a Member sees theirs.
 */
import { useMemo } from 'react';
import { useApi } from './useApi.js';
import { listProjects } from '../api/projects.js';

export function useVisibleProjects() {
  const state = useApi((signal) => listProjects({ size: 100 }, { signal }), []);
  const projects = state.data?.content ?? [];
  const ids = useMemo(() => new Set(projects.map((p) => p.projectId)), [projects]);
  return { ...state, projects, ids };
}
