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
    const systemInfo = await database.getSystemInfo();
    return NextResponse.json(systemInfo);
  } catch (error) {
    console.error("Failed to fetch system info:", error);
    return NextResponse.json(
      { error: "Failed to fetch system info" },
      { status: 500 }
    );
  }
}
