"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Clock, CheckCircle, XCircle, Loader2, Code, Calendar, Trash2 } from "lucide-react"

interface Submission {
  id: string
  language: string
  code: string
  input: string
  status: "queued" | "running" | "completed" | "error" | "timeout"
  output?: string
  stderr?: string
  executionTime?: number
  memoryUsage?: number
  exitCode?: number
  createdAt: string
  completedAt?: string
}

interface Language {
  id: string
  name: string
  extension: string
}

interface HistoryPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  submissions: Submission[]
  onLoadSubmission: (submission: Submission) => void
  languages: Language[]
}

export function HistoryPanel({ open, onOpenChange, submissions, onLoadSubmission, languages }: HistoryPanelProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterLanguage, setFilterLanguage] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "queued":
        return <Clock className="h-4 w-4 text-yellow-500" />
      case "running":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />
      case "timeout":
        return <Clock className="h-4 w-4 text-orange-500" />
      default:
        return null
    }
  }

  const filteredSubmissions = submissions.filter((submission) => {
    const matchesSearch =
      submission.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      submission.language.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesLanguage = filterLanguage === "all" || submission.language === filterLanguage
    const matchesStatus = filterStatus === "all" || submission.status === filterStatus

    return matchesSearch && matchesLanguage && matchesStatus
  })

  const clearHistory = () => {
    localStorage.removeItem("judge0-submissions")
    window.location.reload()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Execution History</span>
            <Badge variant="secondary">{submissions.length} submissions</Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Filters - Fixed */}
        <div className="flex items-center space-x-4 pb-4 border-b flex-shrink-0">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search code or language..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Select value={filterLanguage} onValueChange={setFilterLanguage}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Languages</SelectItem>
              {languages.map((lang) => (
                <SelectItem key={lang.id} value={lang.id}>
                  {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={clearHistory}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
          </Button>
        </div>

        {/* Submissions List - Scrollable */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-3 p-1">
              {filteredSubmissions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {submissions.length === 0 ? (
                    <div>
                      <Code className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No submissions yet</p>
                      <p className="text-sm">Run some code to see your history here</p>
                    </div>
                  ) : (
                    <div>
                      <Search className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No submissions match your filters</p>
                    </div>
                  )}
                </div>
              ) : (
                filteredSubmissions.map((submission) => {
                  const language = languages.find((l) => l.id === submission.language)
                  return (
                    <div
                      key={submission.id}
                      className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => {
                        onLoadSubmission(submission)
                        onOpenChange(false)
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(submission.status)}
                          <div>
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline">{language?.name || submission.language}</Badge>
                              <span className="text-xs text-gray-500">{submission.id.slice(0, 8)}</span>
                            </div>
                            <div className="flex items-center space-x-2 mt-1 text-xs text-gray-500">
                              <Calendar className="h-3 w-3" />
                              <span>{new Date(submission.createdAt).toLocaleString()}</span>
                              {submission.executionTime && (
                                <>
                                  <span>•</span>
                                  <span>{submission.executionTime}ms</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <Badge
                          className={
                            submission.status === "completed"
                              ? "bg-green-500"
                              : submission.status === "error"
                                ? "bg-red-500"
                                : submission.status === "running"
                                  ? "bg-blue-500"
                                  : "bg-yellow-500"
                          }
                        >
                          {submission.status}
                        </Badge>
                      </div>

                      <div className="bg-gray-100 rounded p-3 font-mono text-xs">
                        <div className="line-clamp-3">
                          {submission.code.split("\n").slice(0, 3).join("\n")}
                          {submission.code.split("\n").length > 3 && "..."}
                        </div>
                      </div>

                      {submission.output && (
                        <div className="mt-2 text-xs text-gray-600">
                          <strong>Output:</strong> {submission.output.slice(0, 100)}
                          {submission.output.length > 100 && "..."}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
