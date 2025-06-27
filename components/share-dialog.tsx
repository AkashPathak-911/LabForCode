"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Copy, Share2, Link, Code, Download, ExternalLink } from "lucide-react"

interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  code: string
  language: string
  input: string
}

export function ShareDialog({ open, onOpenChange, code, language, input }: ShareDialogProps) {
  const [shareUrl, setShareUrl] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const { toast } = useToast()

  const generateShareUrl = async () => {
    setIsGenerating(true)
    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          language,
          input,
        }),
      })

      if (response.ok) {
        const { shareId } = await response.json()
        const url = `${window.location.origin}/share/${shareId}`
        setShareUrl(url)
        toast({
          title: "Share link generated",
          description: "Your code snippet is now shareable",
        })
      } else {
        throw new Error("Failed to generate share link")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate share link",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied",
      description: `${label} copied to clipboard`,
    })
  }

  const downloadCode = () => {
    const languageExtensions: Record<string, string> = {
      python: "py",
      javascript: "js",
      java: "java",
      cpp: "cpp",
      c: "c",
      go: "go",
      rust: "rs",
    }

    const extension = languageExtensions[language] || "txt"
    const filename = `code.${extension}`

    const blob = new Blob([code], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: "Downloaded",
      description: `Code saved as ${filename}`,
    })
  }

  const embedCode = `<iframe 
  src="${shareUrl}?embed=true" 
  width="800" 
  height="600" 
  frameborder="0">
</iframe>`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Share2 className="h-5 w-5" />
            <span>Share Code</span>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="link" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="link">Share Link</TabsTrigger>
            <TabsTrigger value="embed">Embed</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-4">Generate a shareable link to your code snippet</p>

              {!shareUrl ? (
                <Button onClick={generateShareUrl} disabled={isGenerating} className="w-full">
                  {isGenerating ? (
                    <>Generating...</>
                  ) : (
                    <>
                      <Link className="h-4 w-4 mr-2" />
                      Generate Share Link
                    </>
                  )}
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Input value={shareUrl} readOnly className="flex-1" />
                    <Button variant="outline" onClick={() => copyToClipboard(shareUrl, "Share link")}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" onClick={() => window.open(shareUrl, "_blank")}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <Badge variant="secondary">Public</Badge>
                    <span>Anyone with this link can view your code</span>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="embed" className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-4">Embed this code snippet in your website or blog</p>

              {shareUrl ? (
                <div className="space-y-3">
                  <Textarea value={embedCode} readOnly className="font-mono text-xs" rows={4} />
                  <Button variant="outline" onClick={() => copyToClipboard(embedCode, "Embed code")} className="w-full">
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Embed Code
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Code className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Generate a share link first to get embed code</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="export" className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-4">Export your code in different formats</p>

              <div className="space-y-3">
                <Button variant="outline" onClick={downloadCode} className="w-full justify-start">
                  <Download className="h-4 w-4 mr-2" />
                  Download as File
                </Button>

                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(code, "Code")}
                  className="w-full justify-start"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Code
                </Button>

                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(`\`\`\`${language}\n${code}\n\`\`\``, "Markdown code block")}
                  className="w-full justify-start"
                >
                  <Code className="h-4 w-4 mr-2" />
                  Copy as Markdown
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-4">Preview how your shared code will appear</p>

              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="outline">{language}</Badge>
                  <span className="text-xs text-gray-500">{code.split("\n").length} lines</span>
                </div>

                <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-sm max-h-40 overflow-y-auto">
                  <pre>{code}</pre>
                </div>

                {input && (
                  <div className="mt-3">
                    <div className="text-xs font-medium text-gray-600 mb-1">Input:</div>
                    <div className="bg-white p-2 rounded text-sm font-mono border">{input}</div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
