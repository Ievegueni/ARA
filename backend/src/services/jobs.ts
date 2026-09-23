import { randomUUID } from "node:crypto";
import type { IngestResult, IngestStage } from "./ingest.js";

/** Estado de uma ingestão em curso (em memória; suficiente para uma única instância do PoC). */
export interface IngestJob {
  id: string;
  title: string;
  version: string;
  fileName: string;
  status: "running" | "done" | "error";
  stage: IngestStage;
  done: number;
  total: number;
  result?: IngestResult;
  error?: string;
  startedAt: number;
}

const jobs = new Map<string, IngestJob>();
const TTL_MS = 60 * 60_000;

export function createJob(init: Pick<IngestJob, "title" | "version" | "fileName">): IngestJob {
  for (const [id, j] of jobs) if (Date.now() - j.startedAt > TTL_MS) jobs.delete(id);
  const job: IngestJob = { ...init, id: randomUUID(), status: "running", stage: "extracting", done: 0, total: 0, startedAt: Date.now() };
  jobs.set(job.id, job);
  return job;
}

export const getJob = (id: string) => jobs.get(id);

export const runningJobs = () => [...jobs.values()].filter((j) => j.status === "running");
