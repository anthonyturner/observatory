/** What the Rerun button changes on GitHub, and nothing else. */
export interface CheckRerunner {
  /** Runs the failed jobs of one GitHub Actions workflow run again, at the same commit. */
  rerunFailedJobs(repo: string, runId: number): Promise<void>;
}

/** The REST path that reruns a workflow run's failed jobs, from below the API's root. */
export const rerunFailedJobsPath = (repo: string, runId: number): string =>
  `repos/${repo}/actions/runs/${runId}/rerun-failed-jobs`;
