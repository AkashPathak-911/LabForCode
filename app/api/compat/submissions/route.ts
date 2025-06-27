/**
 * CodeRunner Pro Judge0 Compatibility API Endpoint
 *
 * This endpoint provides 100% compatibility with Judge0's API format while
 * being completely original code. This allows existing Judge0 clients to
 * work seamlessly with CodeRunner Pro.
 *
 * Features:
 * - Uses tokens instead of IDs in responses
 * - Supports all Judge0 field names and response formats
 * - Returns exact Judge0 response structure
 * - Supports both synchronous (?wait=true) and asynchronous modes
 * - Enhanced performance through Rust execution engine
 */

import { type NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { database, type Submission } from "@/lib/database";
import { addExecutionJob } from "@/lib/queue";
import { submissionRateLimit } from "@/lib/rate-limit";
import { codeExecutor } from "@/lib/executor";

/**
 * Judge0 Compatible API Endpoint
 *
 * This endpoint provides 100% compatibility with Judge0's API format:
 * - Uses tokens instead of IDs in responses
 * - Supports all Judge0 field names
 * - Returns exact Judge0 response format
 * - Supports both synchronous (?wait=true) and asynchronous modes
 */

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = submissionRateLimit(request);
  if (!rateLimitResult.success && rateLimitResult.response) {
    return rateLimitResult.response;
  }

  try {
    const body = await request.json();
    const url = new URL(request.url);
    const wait = url.searchParams.get("wait") === "true";

    // Judge0 compatible field extraction
    const {
      language_id,
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
    } = body;

    // Validate required fields (Judge0 style)
    if (!language_id || !source_code) {
      return NextResponse.json(
        {
          error: "language_id and source_code are required",
          message: "Missing required fields",
        },
        { status: 400 }
      );
    }

    // Generate token (Judge0 uses tokens as primary identifiers)
    const token = uuidv4();
    const submissionId = uuidv4();

    // Map language_id to language name (basic mapping)
    const languageMap: Record<number, string> = {
      45: "assembly",
      46: "bash",
      48: "c",
      50: "c",
      52: "cpp",
      51: "csharp",
      54: "cpp",
      60: "go",
      62: "java",
      63: "javascript",
      70: "python",
      71: "python",
      72: "ruby",
      73: "rust",
      74: "typescript",
    };

    const language = languageMap[language_id] || "python";

    // Prepare submission data (Judge0 compatible)
    const submissionData: Omit<Submission, "created_at" | "token"> = {
      id: submissionId,
      language,
      language_id,
      source_code,
      stdin,
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

    // Create submission in database with explicit token
    await database.createSubmissionWithToken(submissionData, token);

    if (wait) {
      // Synchronous execution - Judge0 compatible
      try {
        // Update status to processing (Judge0 status)
        await database.updateSubmission(submissionId, { status: "running" });

        // Execute directly
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
          language,
          source_code,
          stdin,
          submissionId,
          executionOptions
        );

        // Map result to Judge0 status
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

        // Return Judge0 compatible response
        const completedSubmission = await database.getSubmission(submissionId);
        return NextResponse.json(formatJudge0Response(completedSubmission!));
      } catch (error) {
        // Handle execution error (Judge0 style)
        const updates: Partial<Submission> = {
          status: "error" as const,
          stderr:
            error instanceof Error ? error.message : "Unknown error occurred",
          exit_code: 1,
          finished_at: new Date().toISOString(),
        };

        await database.updateSubmission(submissionId, updates);
        const errorSubmission = await database.getSubmission(submissionId);
        return NextResponse.json(formatJudge0Response(errorSubmission!));
      }
    } else {
      // Asynchronous execution - add to queue
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
        language,
        source_code,
        stdin,
        queueOptions
      );

      // Return queued response (Judge0 style)
      const submission = await database.getSubmission(submissionId);
      return NextResponse.json(formatJudge0Response(submission!));
    }
  } catch (error) {
    console.error("Failed to create submission:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: "Failed to create submission",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const tokens = url.searchParams.get("tokens");

    if (tokens) {
      // Batch retrieval by tokens (Judge0 compatible)
      const tokenList = tokens.split(",").map((t) => t.trim());
      const submissions = await database.getBatchSubmissions(tokenList);
      return NextResponse.json({
        submissions: submissions.map(formatJudge0Response),
      });
    } else {
      // Get all submissions
      const result = await database.getSubmissions();
      const submissions = Array.isArray(result) ? result : result.submissions;
      return NextResponse.json({
        submissions: submissions.map(formatJudge0Response),
      });
    }
  } catch (error) {
    console.error("Failed to fetch submissions:", error);
    return NextResponse.json(
      { error: "Failed to fetch submissions" },
      { status: 500 }
    );
  }
}

/**
 * Format submission response to match Judge0 API exactly
 */
function formatJudge0Response(submission: Submission) {
  // Map internal status to Judge0 status IDs
  const statusMap: Record<string, { id: number; description: string }> = {
    queued: { id: 1, description: "In Queue" },
    running: { id: 2, description: "Processing" },
    accepted: { id: 3, description: "Accepted" },
    completed: { id: 3, description: "Accepted" },
    wrong_answer: { id: 4, description: "Wrong Answer" },
    time_limit_exceeded: { id: 5, description: "Time Limit Exceeded" },
    compilation_error: { id: 6, description: "Compilation Error" },
    runtime_error: { id: 7, description: "Runtime Error" },
    error: { id: 13, description: "Internal Error" },
  };

  const status = statusMap[submission.status] || statusMap["error"];

  return {
    token: submission.token,
    language_id: submission.language_id,
    source_code: submission.source_code,
    stdin: submission.stdin || null,
    expected_output: submission.expected_output || null,
    stdout: submission.stdout || null,
    stderr: submission.stderr || null,
    compile_output: submission.compile_output || null,
    message: submission.message || null,
    status: {
      id: status.id,
      description: status.description,
    },
    created_at: submission.created_at,
    finished_at: submission.finished_at || null,
    time: submission.time ? submission.time.toString() : null,
    wall_time: submission.wall_time ? submission.wall_time.toString() : null,
    memory: submission.memory ? Math.round(submission.memory).toString() : null,
    exit_code: submission.exit_code,
    exit_signal: submission.exit_signal,
    // Include all Judge0 resource limit fields
    cpu_time_limit: submission.cpu_time_limit,
    cpu_extra_time: submission.cpu_extra_time,
    wall_time_limit: submission.wall_time_limit,
    memory_limit: submission.memory_limit,
    stack_limit: submission.stack_limit,
    max_processes_and_or_threads: submission.max_processes_and_or_threads,
    enable_per_process_and_thread_time_limit:
      submission.enable_per_process_and_thread_time_limit,
    enable_per_process_and_thread_memory_limit:
      submission.enable_per_process_and_thread_memory_limit,
    max_file_size: submission.max_file_size,
    redirect_stderr_to_stdout: submission.redirect_stderr_to_stdout,
    enable_network: submission.enable_network,
    number_of_runs: submission.number_of_runs,
    compiler_options: submission.compiler_options,
    command_line_arguments: submission.command_line_arguments,
    callback_url: submission.callback_url,
    additional_files: submission.additional_files,
  };
}
