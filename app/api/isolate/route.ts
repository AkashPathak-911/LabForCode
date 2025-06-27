import { NextResponse } from "next/server";

export async function GET() {
  try {
    return NextResponse.json({
      version: "isolate 1.8.1",
      description: "Sandbox for running untrusted executables",
    });
  } catch (error) {
    console.error("Failed to fetch isolate info:", error);
    return NextResponse.json(
      { error: "Failed to fetch isolate info" },
      { status: 500 }
    );
  }
}
