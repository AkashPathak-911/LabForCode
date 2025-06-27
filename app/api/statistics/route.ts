import { NextRequest, NextResponse } from "next/server";
import { database } from "@/lib/database";
import { apiRateLimit } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = apiRateLimit(request);
  if (!rateLimitResult.success && rateLimitResult.response) {
    return rateLimitResult.response;
  }

  try {
    const url = new URL(request.url);
    const invalidateCache = url.searchParams.get("invalidate_cache") === "true";

    // Try to get statistics, but provide fallback if database is not ready
    let statistics;
    try {
      statistics = await database.getStatistics();
    } catch (dbError) {
      console.warn(
        "Database not ready for statistics, providing default values:",
        dbError
      );
      // Provide default statistics if database is not ready
      statistics = {
        submissions: 0,
        languages: [],
        timestamp: new Date().toISOString(),
        note: "Database initializing...",
      };
    }

    return NextResponse.json(statistics);
  } catch (error) {
    console.error("Failed to fetch statistics:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch statistics",
        details: error instanceof Error ? error.message : "Unknown error",
        submissions: 0,
        languages: [],
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
