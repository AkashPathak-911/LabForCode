import { NextRequest, NextResponse } from "next/server";
import { database } from "@/lib/database";
import { submissionRateLimit } from "@/lib/rate-limit";
import { addExecutionJob } from "@/lib/queue";

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = submissionRateLimit(request);
  if (!rateLimitResult.success && rateLimitResult.response) {
    return rateLimitResult.response;
  }

  try {
    const { submissions } = await request.json();

    if (!Array.isArray(submissions)) {
      return NextResponse.json(
        { error: "submissions must be an array" },
        { status: 400 }
      );
    }

    const results = await database.createBatchSubmissions(submissions);

    // Add all successful submissions to the queue
    for (const submission of results) {
      if (submission.status === "queued") {
        await addExecutionJob(
          submission.token,
          submission.language,
          submission.source_code || submission.code || "",
          submission.stdin || submission.input || ""
        );
      }
    }

    return NextResponse.json(results, { status: 201 });
  } catch (error) {
    console.error("Failed to create batch submissions:", error);
    return NextResponse.json(
      { error: "Failed to create batch submissions" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const tokensParam = url.searchParams.get("tokens");
    const base64Encoded = url.searchParams.get("base64_encoded") === "true";
    const fields = url.searchParams.get("fields")?.split(",");

    if (!tokensParam) {
      return NextResponse.json(
        { error: "tokens parameter is required" },
        { status: 400 }
      );
    }

    const tokens = tokensParam.split(",");
    let submissions = await database.getBatchSubmissions(tokens);

    if (base64Encoded) {
      submissions = submissions.map((sub) => ({
        ...sub,
        stdout: sub.stdout
          ? Buffer.from(sub.stdout).toString("base64")
          : sub.stdout,
        stderr: sub.stderr
          ? Buffer.from(sub.stderr).toString("base64")
          : sub.stderr,
        source_code: sub.source_code
          ? Buffer.from(sub.source_code).toString("base64")
          : sub.source_code,
      }));
    }

    // Filter fields if specified
    if (fields && fields.length > 0) {
      submissions = submissions.map((sub) => {
        const filtered: any = {};
        fields.forEach((field) => {
          if (sub.hasOwnProperty(field)) {
            filtered[field] = (sub as any)[field];
          }
        });
        return filtered;
      });
    }

    return NextResponse.json({ submissions });
  } catch (error) {
    console.error("Failed to fetch batch submissions:", error);
    return NextResponse.json(
      { error: "Failed to fetch batch submissions" },
      { status: 500 }
    );
  }
}
