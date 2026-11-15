"""In-memory analysis jobs.

A custom location may need a NASA POWER download that takes minutes, so an analysis runs on a
worker thread and the client polls for its state. Jobs live in this process only: they are lost
on restart and are not shared between worker processes. That is enough for a single-process
deployment; a multi-process one needs a shared store.
"""
from __future__ import annotations

import logging
import threading
import time
import uuid
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor

log = logging.getLogger("hindsight.jobs")

MAX_JOBS = 60
STAGES = [
    ("prepare", "Preparing your farm profile"),
    ("weather", "Retrieving historical weather"),
    ("soil", "Checking available soil information"),
    ("simulate", "Simulating and comparing crop rotations"),
]


class JobError(Exception):
    """A failure with a message that is safe and useful to show to the farmer."""

    def __init__(self, code: str, detail: str):
        super().__init__(detail)
        self.code, self.detail = code, detail


class Job:
    def __init__(self):
        self.id = uuid.uuid4().hex[:16]
        self.status = "queued"
        self.stage: str | None = None
        self.details: dict[str, str] = {}
        self.created = time.time()
        self.finished: float | None = None
        self.envelope: dict | None = None
        self.comparison: dict | None = None  # set instead of envelope when the job compared several runs
        self.error: dict | None = None

    def enter(self, stage: str, detail: str | None = None):
        self.stage = stage
        if detail:
            self.details[stage] = detail

    def public(self) -> dict:
        order = [s for s, _ in STAGES]
        at = order.index(self.stage) if self.stage in order else -1
        stages = []
        for i, (sid, label) in enumerate(STAGES):
            if self.status == "done" or i < at:
                state = "done"
            elif i == at:
                state = "error" if self.status == "error" else "active"
            else:
                state = "pending"
            stages.append({"id": sid, "label": label, "state": state, "detail": self.details.get(sid)})
        return {
            "analysis_id": self.id, "status": self.status, "stage": self.stage, "stages": stages,
            "elapsed_ms": round(((self.finished or time.time()) - self.created) * 1000),
            "envelope": self.envelope, "comparison": self.comparison, "error": self.error,
        }


class JobManager:
    def __init__(self, workers: int = 2):
        self._jobs: OrderedDict[str, Job] = OrderedDict()
        self._lock = threading.Lock()
        self._pool = ThreadPoolExecutor(max_workers=workers, thread_name_prefix="hindsight-job")

    def submit(self, fn, *args) -> Job:
        job = Job()
        with self._lock:
            self._jobs[job.id] = job
            done = [k for k, j in self._jobs.items() if j.status in ("done", "error")]
            while len(self._jobs) > MAX_JOBS and done:
                self._jobs.pop(done.pop(0), None)
        self._pool.submit(self._run, job, fn, args)
        return job

    def get(self, job_id: str) -> Job | None:
        with self._lock:
            return self._jobs.get(job_id)

    @staticmethod
    def _run(job: Job, fn, args):
        job.status = "running"
        try:
            out = fn(job, *args)
            out["analysis_id"] = job.id
            if out.get("kind") == "comparison":
                job.comparison = out
            else:
                job.envelope = out
            job.status = "done"
        except JobError as exc:
            job.error = {"code": exc.code, "detail": exc.detail}
            job.status = "error"
        except Exception as exc:  # never leak a stack trace to the client; keep it in the server log
            log.exception("analysis job %s failed", job.id)
            job.error = {"code": "internal_error",
                         "detail": f"The analysis stopped unexpectedly ({type(exc).__name__}). Please try again."}
            job.status = "error"
        finally:
            job.finished = time.time()
