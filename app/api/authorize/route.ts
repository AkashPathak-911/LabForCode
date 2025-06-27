import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const authUser = request.headers.get("X-Auth-User");

    if (!authUser) {
      return NextResponse.json(
        { error: "Missing authorization token" },
        { status: 403 }
      );
    }

    // For demo purposes, accept any user token
    // In production, validate against database and check permissions
    if (authUser.length < 10) {
      return NextResponse.json(
        { error: "Invalid authorization token" },
        { status: 403 }
      );
    }

    return NextResponse.json({ message: "Authorization successful" });
  } catch (error) {
    console.error("Authorization failed:", error);
    return NextResponse.json(
      { error: "Authorization failed" },
      { status: 403 }
    );
  }
}
