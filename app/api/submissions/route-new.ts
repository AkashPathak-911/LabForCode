import { type NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { codeExecutor } from "@/lib/executor";

// Enhanced in-memory storage with job queue
const submissions = new Map();
const jobQueue: string[] = [];
const runningJobs = new Set<string>();
const eventStreams = new Map<string, ReadableStreamDefaultController>();

// Enhanced execution with real code execution
const executeCodeWithStreaming = async (submissionId: string) => {
  const submission = submissions.get(submissionId);
  if (!submission) return;

  const controller = eventStreams.get(submissionId);

  // Update status to running
  submission.status = "running";
  submissions.set(submissionId, submission);
  runningJobs.add(submissionId);

  // Send status update
  if (controller) {
    controller.enqueue(
      `data: ${JSON.stringify({
        type: "status",
        submission: { ...submission },
      })}\n\n`
    );
  }

  try {
    // Execute the code using the real executor
    const result = await codeExecutor.executeCode(
      submission.language,
      submission.code,
      submission.input,
      submissionId
    );

    // Check if job was cancelled
    if (!runningJobs.has(submissionId)) {
      submission.status = "error";
      submission.stderr = "Execution cancelled by user";
      submissions.set(submissionId, submission);
      return;
    }

    // Update submission with results
    submission.status = result.exitCode === 0 ? "completed" : "error";
    submission.output = result.stdout;
    submission.stderr = result.stderr;
    submission.executionTime = result.executionTime;
    submission.memoryUsage = result.memoryUsage;
    submission.exitCode = result.exitCode;
    submission.completedAt = new Date().toISOString();

    // Send output chunks during execution
    if (controller && result.stdout) {
      controller.enqueue(
        `data: ${JSON.stringify({
          type: "output",
          chunk: result.stdout,
        })}\n\n`
      );
    }
  } catch (error) {
    submission.status = "error";
    submission.stderr =
      error instanceof Error ? error.message : "Unknown error occurred";
    submission.exitCode = 1;
    submission.completedAt = new Date().toISOString();
  } finally {
    runningJobs.delete(submissionId);
    submissions.set(submissionId, submission);

    // Send final status update
    if (controller) {
      controller.enqueue(
        `data: ${JSON.stringify({
          type: "status",
          submission: { ...submission },
        })}\n\n`
      );

      controller.close();
      eventStreams.delete(submissionId);
    }
  }
};

// Process job queue with concurrency control
const processQueue = async () => {
  const maxConcurrentJobs = 3;

  while (jobQueue.length > 0 && runningJobs.size < maxConcurrentJobs) {
    const submissionId = jobQueue.shift();
    if (submissionId && !runningJobs.has(submissionId)) {
      executeCodeWithStreaming(submissionId);
    }
  }
};

// Start queue processor
setInterval(processQueue, 100);

export async function POST(request: NextRequest) {
  try {
    const { language, code, input } = await request.json();

    if (!language || !code) {
      return NextResponse.json(
        { error: "Language and code are required" },
        { status: 400 }
      );
    }

    const submission = {
      id: uuidv4(),
      language,
      code,
      input: input || "",
      status: "queued",
      createdAt: new Date().toISOString(),
    };

    submissions.set(submission.id, submission);
    jobQueue.push(submission.id);

    return NextResponse.json(submission);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create submission" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const allSubmissions = Array.from(submissions.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return NextResponse.json(allSubmissions);
}
