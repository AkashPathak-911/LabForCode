import { NextResponse } from "next/server";

export async function GET() {
  try {
    return NextResponse.json({
      license: "MIT License",
      url: "https://github.com/your-username/CodeLabRunner/blob/main/LICENSE",
      note: "This is an original implementation inspired by Judge0, not derived from Judge0 code",
    });
  } catch (error) {
    console.error("Failed to fetch license:", error);
    return NextResponse.json(
      { error: "Failed to fetch license" },
      { status: 500 }
    );
  }
}
