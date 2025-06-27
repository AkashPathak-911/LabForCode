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
    const configInfo = await database.getConfigInfo();
    return NextResponse.json(configInfo);
  } catch (error) {
    console.error("Failed to fetch config info:", error);
    return NextResponse.json(
      { error: "Failed to fetch config info" },
      { status: 500 }
    );
  }
}
