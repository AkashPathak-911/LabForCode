import { type NextRequest, NextResponse } from "next/server";
import { cancelJob } from "@/lib/queue";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const submissionId = params.id;
    const cancelled = await cancelJob(submissionId);

    if (cancelled) {
      return NextResponse.json({ message: "Execution stopped" });
    }

    return NextResponse.json(
      { message: "Job not running or not found" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Failed to stop execution:", error);
    return NextResponse.json(
      { error: "Failed to stop execution" },
      { status: 500 }
    );
  }
}
