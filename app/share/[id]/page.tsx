"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MonacoEditor } from "@/components/monaco-editor"
import { Copy, Eye, Calendar, Code, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface SharedSnippet {
  id: string
  code: string
  language: string
  input: string
  createdAt: string
  views: number
}

const LANGUAGES = [
  { id: "python", name: "Python 3.11" },
  { id: "javascript", name: "Node.js 18" },
  { id: "java", name: "Java 17" },
  { id: "cpp", name: "C++ 17" },
  { id: "c", name: "C 17" },
  { id: "go", name: "Go 1.21" },
  { id: "rust", name: "Rust 1.70" },
]

export default function SharedSnippetPage() {
  const params = useParams()
  const [snippet, setSnippet] = useState<SharedSnippet | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const { toast } = useToast()

  useEffect(() => {
    const fetchSnippet = async () => {
      try {
        const response = await fetch(`/api/share?id=${params.id}`)
        if (response.ok) {
          const data = await response.json()
          setSnippet(data)
        } else {
          setError("Snippet not found")
        }
      } catch (err) {
        setError("Failed to load snippet")
      } finally {
        setLoading(false)
      }
    }

    if (params.id) {
      fetchSnippet()
    }
  }, [params.id])

  const copyCode = () => {
    if (snippet) {
      navigator.clipboard.writeText(snippet.code)
      toast({
        title: "Copied",
        description: "Code copied to clipboard",
      })
    }
  }

  const openInEditor = () => {
    const editorUrl = `/?code=${encodeURIComponent(snippet?.code || "")}&language=${snippet?.language}&input=${encodeURIComponent(snippet?.input || "")}`
    window.open(editorUrl, "_blank")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading snippet...</p>
        </div>
      </div>
    )
  }

  if (error || !snippet) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Code className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-semibold mb-2">Snippet Not Found</h2>
            <p className="text-gray-600 mb-4">
              {error || "The shared code snippet you're looking for doesn't exist or has been removed."}
            </p>
            <Button onClick={() => (window.location.href = "/")}>Go to Editor</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const language = LANGUAGES.find((l) => l.id === snippet.language)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 border-b bg-white px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold">Shared Code Snippet</h1>
            <Badge variant="outline">{language?.name || snippet.language}</Badge>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 text-sm text-gray-500">
              <Eye className="h-4 w-4" />
              <span>{snippet.views} views</span>
            </div>

            <Button variant="outline" size="sm" onClick={copyCode}>
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>

            <Button size="sm" onClick={openInEditor}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in Editor
            </Button>
          </div>
        </div>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Code className="h-5 w-5" />
                    <span>Code</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="h-96 overflow-hidden">
                    <MonacoEditor
                      value={snippet.code}
                      onChange={() => {}} // Read-only
                      language={snippet.language}
                      theme="vs-dark"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Language</label>
                    <p className="text-sm">{language?.name || snippet.language}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-600">Created</label>
                    <div className="flex items-center space-x-1 text-sm">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(snippet.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-600">Lines of Code</label>
                    <p className="text-sm">{snippet.code.split("\n").length}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-600">Characters</label>
                    <p className="text-sm">{snippet.code.length}</p>
                  </div>
                </CardContent>
              </Card>

              {snippet.input && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Input</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-sm bg-gray-100 p-3 rounded font-mono whitespace-pre-wrap">{snippet.input}</pre>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
