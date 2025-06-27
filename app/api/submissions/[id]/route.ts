import { type NextRequest, NextResponse } from "next/server";
import { database } from "@/lib/database";
import { getJobStatus } from "@/lib/queue";
import { apiRateLimit } from "@/lib/rate-limit";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const url = new URL(request.url);
    const base64Encoded = url.searchParams.get("base64_encoded") === "true";
    const fields = url.searchParams.get("fields")?.split(",");

    const submission = await database.getSubmission(params.id);

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    // If submission is still in queue/running, get job status
    if (submission.status === "queued" || submission.status === "running") {
      const jobStatus = await getJobStatus(params.id);
      if (jobStatus) {
        submission.status = jobStatus.status as any;
      }
    }

    let result = { ...submission };

    // Handle base64 encoding
    if (base64Encoded) {
      result = {
        ...result,
        stdout: result.stdout
          ? Buffer.from(result.stdout).toString("base64")
          : result.stdout,
        stderr: result.stderr
          ? Buffer.from(result.stderr).toString("base64")
          : result.stderr,
        source_code: result.source_code
          ? Buffer.from(result.source_code).toString("base64")
          : result.source_code,
      };
    }

    // Check for non-UTF8 content
    const hasNonUtf8 = (str: string | undefined) => {
      if (!str) return false;
      try {
        Buffer.from(str, "utf8").toString();
        return false;
      } catch {
        return true;
      }
    };

    if (
      !base64Encoded &&
      (hasNonUtf8(result.stdout) ||
        hasNonUtf8(result.stderr) ||
        hasNonUtf8(result.source_code))
    ) {
      return NextResponse.json(
        {
          error:
            "some attributes for this submission cannot be converted to UTF-8, use base64_encoded=true query parameter",
        },
        { status: 400 }
      );
    }

    // Filter fields if specified
    if (fields && fields.length > 0) {
      const filtered: any = {};
      const defaultFields = [
        "stdout",
        "time",
        "memory",
        "stderr",
        "token",
        "compile_output",
        "message",
        "status",
      ];
      const fieldsToUse = fields.length > 0 ? fields : defaultFields;

      fieldsToUse.forEach((field) => {
        if (result.hasOwnProperty(field)) {
          filtered[field] = (result as any)[field];
        }
      });
      result = filtered;
    }

    return NextResponse.json(result);
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
  { params }: { params: { id: string } }
) {
  try {
    const url = new URL(request.url);
    const fields = url.searchParams.get("fields")?.split(",");

    const deletedSubmission = await database.deleteSubmission(params.id);

    if (!deletedSubmission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 }
      );
    }

    // Always return base64 encoded for delete
    let result = {
      ...deletedSubmission,
      stdout: deletedSubmission.stdout
        ? Buffer.from(deletedSubmission.stdout).toString("base64")
        : deletedSubmission.stdout,
      stderr: deletedSubmission.stderr
        ? Buffer.from(deletedSubmission.stderr).toString("base64")
        : deletedSubmission.stderr,
      source_code: deletedSubmission.source_code
        ? Buffer.from(deletedSubmission.source_code).toString("base64")
        : deletedSubmission.source_code,
    };

    // Filter fields if specified
    if (fields && fields.length > 0) {
      const filtered: any = {};
      const defaultFields = [
        "stdout",
        "time",
        "memory",
        "stderr",
        "token",
        "compile_output",
        "message",
        "status",
      ];
      const fieldsToUse = fields.length > 0 ? fields : defaultFields;

      fieldsToUse.forEach((field) => {
        if (result.hasOwnProperty(field)) {
          filtered[field] = (result as any)[field];
        }
      });
      result = filtered;
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes("cannot be deleted")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to delete submission:", error);
    return NextResponse.json(
      { error: "Failed to delete submission" },
      { status: 500 }
    );
  }
}
