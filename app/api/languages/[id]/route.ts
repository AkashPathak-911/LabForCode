import { NextRequest, NextResponse } from "next/server";
import { database } from "@/lib/database";
import { apiRateLimit } from "@/lib/rate-limit";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Apply rate limiting
  const rateLimitResult = apiRateLimit(request);
  if (!rateLimitResult.success && rateLimitResult.response) {
    return rateLimitResult.response;
  }

  try {
    const languageId = parseInt(params.id);
    if (isNaN(languageId)) {
      return NextResponse.json(
        { error: "Invalid language ID" },
        { status: 400 }
      );
    }

    const language = await database.getLanguage(languageId);
    if (!language) {
      return NextResponse.json(
        { error: "Language not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(language);
  } catch (error) {
    console.error("Failed to fetch language:", error);
    return NextResponse.json(
      { error: "Failed to fetch language" },
      { status: 500 }
    );
  }
}
