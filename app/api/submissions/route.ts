import { type NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { database, type Submission } from "@/lib/database";
import { addExecutionJob, getJobStatus } from "@/lib/queue";
import { submissionRateLimit, apiRateLimit } from "@/lib/rate-limit";
import { codeExecutor } from "@/lib/executor";

// Event streams for real-time updates
const eventStreams = new Map<string, ReadableStreamDefaultController>();

export async function POST(request: NextRequest) {
  // Apply rate limiting for code executions
  const rateLimitResult = submissionRateLimit(request);
  if (!rateLimitResult.success && rateLimitResult.response) {
    return rateLimitResult.response;
  }

  try {
    const body = await request.json();
    const url = new URL(request.url);
    const wait = url.searchParams.get("wait") === "true";

    // Extract Judge0 compatible fields
    const {
      language_id,
      language,
      source_code,
      stdin = "",
      expected_output,
      cpu_time_limit,
      cpu_extra_time,
      wall_time_limit,
      memory_limit,
      stack_limit,
      max_processes_and_or_threads,
      enable_per_process_and_thread_time_limit,
      enable_per_process_and_thread_memory_limit,
      max_file_size,
      redirect_stderr_to_stdout,
      enable_network,
      number_of_runs,
      compiler_options,
      command_line_arguments,
      callback_url,
      additional_files,
      // Legacy field names
      code = source_code,
      input = stdin,
    } = body;

    // Validate required fields
    const finalLanguage = language || language_id;
    const finalCode = code || source_code;

    if (!finalLanguage || !finalCode) {
      return NextResponse.json(
        { error: "Language and source code are required" },
        { status: 400 }
      );
    }

    // Create submission token and ID
    const submissionId = uuidv4();
    const token = uuidv4();

    // Prepare submission data with all Judge0 fields
    const submissionData: Omit<Submission, "created_at" | "token"> = {
      id: submissionId,
      language: finalLanguage,
      language_id:
        typeof finalLanguage === "number" ? finalLanguage : undefined,
      source_code: finalCode,
      stdin: input,
      expected_output,
      cpu_time_limit,
      cpu_extra_time,
      wall_time_limit,
      memory_limit,
      stack_limit,
      max_processes_and_or_threads,
      enable_per_process_and_thread_time_limit,
      enable_per_process_and_thread_memory_limit,
      max_file_size,
      redirect_stderr_to_stdout,
      enable_network,
      number_of_runs,
      compiler_options,
      command_line_arguments,
      callback_url,
      additional_files,
      status: "queued" as const,
    };

    // Create submission in database
    const submission = await database.createSubmission(submissionData);

    if (wait) {
      // Synchronous execution - execute immediately and wait for result
      try {
        // Update status to running
        await database.updateSubmission(submissionId, { status: "running" });

        // Execute directly using the executor
        const executionOptions = {
          compiler_options,
          command_line_arguments,
          cpu_time_limit,
          cpu_extra_time,
          wall_time_limit,
          memory_limit,
          stack_limit,
          max_processes_and_or_threads,
          enable_per_process_and_thread_time_limit,
          enable_per_process_and_thread_memory_limit,
          max_file_size,
          redirect_stderr_to_stdout,
          enable_network,
          number_of_runs,
          additional_files,
        };

        const result = await codeExecutor.execute(
          finalLanguage,
          finalCode,
          input,
          submissionId,
          executionOptions
        );

        // Update submission with results
        const status: Submission["status"] =
          result.exitCode === 0 ? "accepted" : "runtime_error";
        const updates: Partial<Submission> = {
          status,
          stdout: result.stdout,
          stderr: result.stderr,
          compile_output: result.compileOutput,
          time: result.executionTime ? result.executionTime / 1000 : undefined,
          memory: result.memoryUsage ? result.memoryUsage / 1024 : undefined,
          exit_code: result.exitCode,
          finished_at: new Date().toISOString(),
        };

        await database.updateSubmission(submissionId, updates);

        // Return the completed submission
        const completedSubmission = await database.getSubmission(submissionId);
        return NextResponse.json(completedSubmission);
      } catch (error) {
        // Handle execution error
        const updates: Partial<Submission> = {
          status: "error" as const,
          stderr:
            error instanceof Error ? error.message : "Unknown error occurred",
          message:
            error instanceof Error ? error.message : "Unknown error occurred",
          exit_code: 1,
          finished_at: new Date().toISOString(),
        };

        await database.updateSubmission(submissionId, updates);
        const errorSubmission = await database.getSubmission(submissionId);
        return NextResponse.json(errorSubmission);
      }
    } else {
      // Asynchronous execution - add to queue and return immediately
      const queueOptions = {
        compiler_options,
        command_line_arguments,
        cpu_time_limit,
        cpu_extra_time,
        wall_time_limit,
        memory_limit,
        stack_limit,
        max_processes_and_or_threads,
        enable_per_process_and_thread_time_limit,
        enable_per_process_and_thread_memory_limit,
        max_file_size,
        redirect_stderr_to_stdout,
        enable_network,
        number_of_runs,
        callback_url,
        additional_files,
      };

      await addExecutionJob(
        submissionId,
        finalLanguage,
        finalCode,
        input,
        queueOptions
      );
      return NextResponse.json(submission);
    }
  } catch (error) {
    console.error("Failed to create submission:", error);
    return NextResponse.json(
      { error: "Failed to create submission" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Apply rate limiting for API calls
  const rateLimitResult = apiRateLimit(request);
  if (!rateLimitResult.success && rateLimitResult.response) {
    return rateLimitResult.response;
  }

  try {
    const submissions = await database.getSubmissions();
    return NextResponse.json(submissions);
  } catch (error) {
    console.error("Failed to fetch submissions:", error);
    return NextResponse.json(
      { error: "Failed to fetch submissions" },
      { status: 500 }
    );
  }
}
