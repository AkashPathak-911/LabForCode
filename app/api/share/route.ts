import { type NextRequest, NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"

// In-memory storage for shared snippets
const sharedSnippets = new Map()

export async function POST(request: NextRequest) {
  try {
    const { code, language, input } = await request.json()

    if (!code || !language) {
      return NextResponse.json({ error: "Code and language are required" }, { status: 400 })
    }

    const shareId = uuidv4().slice(0, 8) // Short ID for sharing
    const snippet = {
      id: shareId,
      code,
      language,
      input: input || "",
      createdAt: new Date().toISOString(),
      views: 0,
    }

    sharedSnippets.set(shareId, snippet)

    return NextResponse.json({ shareId })
  } catch (error) {
    return NextResponse.json({ error: "Failed to create share link" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const shareId = searchParams.get("id")

  if (!shareId) {
    return NextResponse.json({ error: "Share ID required" }, { status: 400 })
  }

  const snippet = sharedSnippets.get(shareId)
  if (!snippet) {
    return NextResponse.json({ error: "Snippet not found" }, { status: 404 })
  }

  // Increment view count
  snippet.views++
  sharedSnippets.set(shareId, snippet)

  return NextResponse.json(snippet)
}
