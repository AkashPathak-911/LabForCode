import { NextResponse } from "next/server";

/**
 * Judge0 Compatible Statuses Endpoint
 *
 * Returns the list of possible execution statuses in Judge0 format
 */

export async function GET() {
  try {
    // Judge0 compatible status list
    const statuses = [
      {
        id: 1,
        description: "In Queue",
      },
      {
        id: 2,
        description: "Processing",
      },
      {
        id: 3,
        description: "Accepted",
      },
      {
        id: 4,
        description: "Wrong Answer",
      },
      {
        id: 5,
        description: "Time Limit Exceeded",
      },
      {
        id: 6,
        description: "Compilation Error",
      },
      {
        id: 7,
        description: "Runtime Error (SIGSEGV)",
      },
      {
        id: 8,
        description: "Runtime Error (SIGXFSZ)",
      },
      {
        id: 9,
        description: "Runtime Error (SIGFPE)",
      },
      {
        id: 10,
        description: "Runtime Error (SIGABRT)",
      },
      {
        id: 11,
        description: "Runtime Error (NZEC)",
      },
      {
        id: 12,
        description: "Runtime Error (Other)",
      },
      {
        id: 13,
        description: "Internal Error",
      },
      {
        id: 14,
        description: "Exec Format Error",
      },
    ];

    return NextResponse.json(statuses);
  } catch (error) {
    console.error("Failed to fetch statuses:", error);
    return NextResponse.json(
      { error: "Failed to fetch statuses" },
      { status: 500 }
    );
  }
}
