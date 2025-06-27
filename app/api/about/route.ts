import { NextResponse } from "next/server";

export async function GET() {
  try {
    return NextResponse.json({
      version: "1.13.1",
      homepage: "https://github.com/your-username/CodeLabRunner",
      source_code: "https://github.com/your-username/CodeLabRunner",
      maintainer: "CodeRunner Pro Team <team@coderunner.pro>",
      description: "Judge0-compatible API implementation built from scratch",
      compatibility: "Judge0 API v1.13.1 compatible (original implementation)",
    });
  } catch (error) {
    console.error("Failed to fetch about info:", error);
    return NextResponse.json(
      { error: "Failed to fetch about info" },
      { status: 500 }
    );
  }
}
