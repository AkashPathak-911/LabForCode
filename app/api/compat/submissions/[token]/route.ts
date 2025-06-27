import { type NextRequest, NextResponse } from "next/server";
import { database } from "@/lib/database";
import { apiRateLimit } from "@/lib/rate-limit";
import { cancelJob } from "@/lib/queue";

/**
 * Judge0 Compatible Submission Token Endpoint
 *
 * GET /api/judge0/submissions/{token} - Get submission by token
 * DELETE /api/judge0/submissions/{token} - Delete submission by token
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  // Apply rate limiting
  const rateLimitResult = apiRateLimit(request);
  if (!rateLimitResult.success && rateLimitResult.response) {
    return rateLimitResult.response;
  }

  try {
    const { token } = params;

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // Get submission by token
    const submission = await database.getSubmission(token);

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    // Return Judge0 compatible response
    return NextResponse.json(formatJudge0Response(submission));
  } catch (error) {
    console.error("Failed to fetch submission:", error);
    return NextResponse.json(
      { error: "Failed to fetch submission" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  // Apply rate limiting
  const rateLimitResult = apiRateLimit(request);
  if (!rateLimitResult.success && rateLimitResult.response) {
    return rateLimitResult.response;
  }

  try {
    const { token } = params;

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // Get submission first to check if it exists
    const submission = await database.getSubmission(token);

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    // Cancel job if it's still running
    if (submission.status === "queued" || submission.status === "running") {
      await cancelJob(submission.id);
    }

    // Delete the submission
    const deleted = await database.deleteSubmission(token);

    if (!deleted) {
      return NextResponse.json(
        { error: "Failed to delete submission" },
        { status: 500 }
      );
    }

    // Return success response (Judge0 style)
    return NextResponse.json({
      message: "Submission deleted successfully",
    });
  } catch (error) {
    console.error("Failed to delete submission:", error);
    return NextResponse.json(
      { error: "Failed to delete submission" },
      { status: 500 }
    );
  }
}

/**
 * Format submission response to match Judge0 API exactly
 */
function formatJudge0Response(submission: any) {
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
