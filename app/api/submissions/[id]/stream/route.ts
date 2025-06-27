import type { NextRequest } from "next/server";
import { database } from "@/lib/database";
import { getJobStatus } from "@/lib/queue";

// Event streams for real-time updates
const eventStreams = new Map<string, ReadableStreamDefaultController>();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const submissionId = params.id;

  try {
    const submission = await database.getSubmission(submissionId);

    if (!submission) {
      return new Response("Submission not found", { status: 404 });
    }

    const stream = new ReadableStream({
      start(controller) {
        eventStreams.set(submissionId, controller);

        // Send initial status
        controller.enqueue(
          `data: ${JSON.stringify({
            type: "status",
            submission: submission,
          })}\n\n`
        );

        // If already completed, close immediately
        if (
          submission.status === "completed" ||
          submission.status === "error" ||
          submission.status === "timeout"
        ) {
          controller.close();
          eventStreams.delete(submissionId);
        } else {
          // Poll for updates every second for running/queued jobs
          const pollInterval = setInterval(async () => {
            try {
              const updatedSubmission = await database.getSubmission(
                submissionId
              );
              if (updatedSubmission) {
                controller.enqueue(
                  `data: ${JSON.stringify({
                    type: "status",
                    submission: updatedSubmission,
                  })}\n\n`
                );

                // Close if job is finished
                if (
                  updatedSubmission.status === "completed" ||
                  updatedSubmission.status === "error" ||
                  updatedSubmission.status === "timeout"
                ) {
                  clearInterval(pollInterval);
                  controller.close();
                  eventStreams.delete(submissionId);
                }
              }
            } catch (error) {
              console.error("Error polling submission status:", error);
              clearInterval(pollInterval);
              controller.close();
              eventStreams.delete(submissionId);
            }
          }, 1000);

          // Cleanup interval on cancel
          const originalCancel = controller.close.bind(controller);
          controller.close = () => {
            clearInterval(pollInterval);
            originalCancel();
          };
        }
      },
      cancel() {
        eventStreams.delete(submissionId);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Failed to create stream:", error);
    return new Response("Internal server error", { status: 500 });
  }
}
