import { NextResponse } from "next/server";

export async function GET() {
  try {
    return NextResponse.json({
      version: "1.13.1",
    });
  } catch (error) {
    console.error("Failed to fetch version:", error);
    return NextResponse.json(
      { error: "Failed to fetch version" },
      { status: 500 }
    );
  }
}
