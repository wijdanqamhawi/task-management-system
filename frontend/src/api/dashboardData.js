/*
 * Dashboard data loading — Week 3 frontend JSON exercise.
 *
 * Tasks and projects are read with fetch() from static JSON files in public/data/. This is
 * the ONLY place that knows where that data lives: to move to a real API later, change the
 * two paths below (or the body of fetchJson) and nothing in the Dashboard needs to change.
 */
import { useEffect, useState } from 'react';

// BASE_URL keeps the paths correct if the app is ever served from a sub-path.
const TASKS_URL = `${import.meta.env.BASE_URL}data/tasks.json`;
const PROJECTS_URL = `${import.meta.env.BASE_URL}data/projects.json`;

async function fetchJson(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Request for ${url} failed with status ${response.status}`);
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Response from ${url} is not valid JSON`);
  }
  if (!Array.isArray(data)) throw new Error(`Response from ${url} is not a list`);
  return data;
}

/**
 * Loads one list. Returns { data, loading, error } where `error` is a user-friendly message
 * (or null). Technical detail goes to the console only.
 */
function useJsonList(url, noun) {
  const [state, setState] = useState({ data: [], loading: true, error: null });

  useEffect(() => {
    const controller = new AbortController();
    setState({ data: [], loading: true, error: null });

    fetchJson(url, controller.signal)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((err) => {
        if (err.name === 'AbortError') return;   // unmounted / effect re-run: not a failure
        console.error(`Failed to load ${noun}:`, err);
        setState({
          data: [],
          loading: false,
          error: `We couldn't load the ${noun}. Please refresh the page and try again.`,
        });
      });

    return () => controller.abort();
  }, [url, noun]);

  return state;
}

export const useTasks = () => useJsonList(TASKS_URL, 'tasks');
export const useProjects = () => useJsonList(PROJECTS_URL, 'projects');
