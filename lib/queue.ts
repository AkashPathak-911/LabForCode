import Queue, { Job } from "bull";
import Redis from "ioredis";
import { sendWebhook } from "./webhook";
import { rustEngineClient } from "./rust-engine-client";

// Lazy imports to prevent initialization during build
let codeExecutor: any;
let database: any;

// Check if Rust engine should be used
const USE_RUST_ENGINE =
  process.env.USE_RUST_ENGINE === "true" ||
  process.env.NODE_ENV === "production";

const initializeDependencies = async () => {
  if (!codeExecutor) {
    const executorModule = await import("./executor");
    codeExecutor = executorModule.codeExecutor;
  }
  if (!database) {
    const dbModule = await import("./database");
    database = dbModule.database;
  }
};

// Redis connection with conditional initialization
let redis: Redis | null = null;
let executionQueue: Queue.Queue<ExecutionJobData> | null = null;

const initializeQueue = () => {
  if (typeof window !== "undefined" || process.env.NEXT_PHASE) {
    // Don't initialize on client side or during build
    return null;
  }

  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }

  if (!executionQueue) {
    executionQueue = new Queue("code execution", {
      redis: {
        port: parseInt(process.env.REDIS_PORT || "6379"),
        host: process.env.REDIS_HOST || "localhost",
        ...(process.env.REDIS_URL && {
          // Parse Redis URL if provided
          ...(() => {
            try {
              const url = new URL(process.env.REDIS_URL!);
              return {
                host: url.hostname,
                port: parseInt(url.port || "6379"),
                password: url.password || undefined,
              };
            } catch {
              return {};
            }
          })(),
        }),
      },
      defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 50, // Keep last 50 failed jobs
        attempts: 1, // No retries for code execution
        timeout: 60000, // 60 second timeout
      },
    });

    // Set up job processing only if we have a queue
    setupJobProcessing();
  }

  return executionQueue;
};

// Get queue instance safely
const getQueue = () => {
  const queue = initializeQueue();
  if (!queue) {
    throw new Error("Queue not available during build time");
  }
  return queue;
};

const setupJobProcessing = () => {
  if (!executionQueue) return;

  // Process jobs
  executionQueue.process("execute", async (job: Job<ExecutionJobData>) => {
    await initializeDependencies();
    const { submissionId, language, code, input, ...options } = job.data;
    try {
      // Update status to running in database
      await database.updateSubmission(submissionId, {
        status: "running",
      });

      // Execute the code
      const result = await codeExecutor.execute(
        language,
        code,
        input,
        submissionId,
        options
      ); // Update submission with results
      const status = result.exitCode === 0 ? "completed" : "error";
      const updates = {
        status,
        stdout: result.stdout,
        output: result.stdout, // backward compatibility
        stderr: result.stderr,
        time: result.executionTime ? result.executionTime / 1000 : undefined, // convert to seconds
        execution_time: result.executionTime, // backward compatibility
        memory: result.memoryUsage ? result.memoryUsage / 1024 : undefined, // convert to KB
        memory_usage: result.memoryUsage, // backward compatibility
        exit_code: result.exitCode,
        finished_at: new Date().toISOString(),
        completed_at: new Date().toISOString(), // backward compatibility
      };

      await database.updateSubmission(submissionId, updates);

      // Send webhook if callback_url is provided
      const submission = await database.getSubmission(submissionId);
      if (submission && submission.callback_url) {
        await sendWebhook(submission);
      }

      return {
        submissionId,
        success: result.exitCode === 0,
        output: result.stdout,
        stderr: result.stderr,
        executionTime: result.executionTime,
        memoryUsage: result.memoryUsage,
        exitCode: result.exitCode,
      } as ExecutionJobResult;
    } catch (error) {
      // Update submission with error
      const updates = {
        status: "error",
        stderr:
          error instanceof Error ? error.message : "Unknown error occurred",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
        exit_code: 1,
        finished_at: new Date().toISOString(),
        completed_at: new Date().toISOString(), // backward compatibility
      };

      await database.updateSubmission(submissionId, updates);

      // Send webhook if callback_url is provided
      const submission = await database.getSubmission(submissionId);
      if (submission && submission.callback_url) {
        await sendWebhook(submission);
      }

      return {
        submissionId,
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      } as ExecutionJobResult;
    }
  });

  // Job event handlers
  executionQueue.on(
    "completed",
    (job: Job<ExecutionJobData>, result: ExecutionJobResult) => {
      console.log(
        `Job ${job.id} completed for submission ${result.submissionId}`
      );
    }
  );

  executionQueue.on("failed", (job: Job<ExecutionJobData>, err: Error) => {
    console.error(`Job ${job.id} failed:`, err.message);
  });

  executionQueue.on("stalled", (job: Job<ExecutionJobData>) => {
    console.warn(`Job ${job.id} stalled`);
  });
};

export interface ExecutionJobData {
  submissionId: string;
  language: string;
  code: string;
  input: string;
  // Judge0 resource limits and options
  compiler_options?: string;
  command_line_arguments?: string;
  cpu_time_limit?: number;
  cpu_extra_time?: number;
  wall_time_limit?: number;
  memory_limit?: number;
  stack_limit?: number;
  max_processes_and_or_threads?: number;
  enable_per_process_and_thread_time_limit?: boolean;
  enable_per_process_and_thread_memory_limit?: boolean;
  max_file_size?: number;
  redirect_stderr_to_stdout?: boolean;
  enable_network?: boolean;
  number_of_runs?: number;
  callback_url?: string;
  additional_files?: string;
}

export interface ExecutionJobResult {
  submissionId: string;
  success: boolean;
  output?: string;
  stderr?: string;
  executionTime?: number;
  memoryUsage?: number;
  exitCode?: number;
  error?: string;
}

// Helper function to add execution job
export async function addExecutionJob(
  submissionId: string,
  language: string,
  code: string,
  input: string = "",
  options: Partial<
    Omit<ExecutionJobData, "submissionId" | "language" | "code" | "input">
  > = {}
): Promise<void> {
  const queue = getQueue();
  await queue.add(
    "execute",
    {
      submissionId,
      language,
      code,
      input,
      ...options,
    } as ExecutionJobData,
    {
      priority: 1, // Higher priority for newer jobs
      jobId: submissionId, // Use submission ID as job ID for easier tracking
    }
  );
}

// Helper function to get job status
export async function getJobStatus(submissionId: string) {
  const queue = getQueue();
  const job = await queue.getJob(submissionId);
  if (!job) return null;

  return {
    id: job.id,
    status: await job.getState(),
    progress: job.progress(),
    createdAt: new Date(job.timestamp),
    processedAt: job.processedOn ? new Date(job.processedOn) : null,
    finishedAt: job.finishedOn ? new Date(job.finishedOn) : null,
    failedAt: job.failedReason ? new Date(job.timestamp) : null,
    error: job.failedReason,
  };
}

// Helper function to cancel a job
export async function cancelJob(submissionId: string): Promise<boolean> {
  const queue = getQueue();
  const job = await queue.getJob(submissionId);
  if (!job) return false;

  try {
    await job.remove();

    // Also stop any running Docker containers
    await initializeDependencies();
    await codeExecutor.stopExecution(submissionId);

    // Update submission status
    await database.updateSubmission(submissionId, {
      status: "error",
      stderr: "Execution cancelled by user",
      completed_at: new Date().toISOString(),
    });

    return true;
  } catch (error) {
    console.error("Failed to cancel job:", error);
    return false;
  }
}

// Get queue statistics
export async function getQueueStats() {
  const queue = getQueue();
  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaiting(),
    queue.getActive(),
    queue.getCompleted(),
    queue.getFailed(),
  ]);

  return {
    waiting: waiting.length,
    active: active.length,
    completed: completed.length,
    failed: failed.length,
    total: waiting.length + active.length + completed.length + failed.length,
  };
}

// Graceful shutdown
export async function closeQueue() {
  if (executionQueue) {
    await executionQueue.close();
  }
  if (redis) {
    redis.disconnect();
  }
}
