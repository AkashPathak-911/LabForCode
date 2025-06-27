import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const authToken = request.headers.get("X-Auth-Token");

    if (!authToken) {
      return NextResponse.json(
        { error: "Missing authentication token" },
        { status: 401 }
      );
    }

    // For demo purposes, accept any token
    // In production, validate against database
    if (authToken.length < 10) {
      return NextResponse.json(
        { error: "Invalid authentication token" },
        { status: 401 }
      );
    }

    return NextResponse.json({ message: "Authentication successful" });
  } catch (error) {
    console.error("Authentication failed:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 401 }
    );
  }
}
