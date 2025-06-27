"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Copy,
  Terminal,
  FileText,
  AlertTriangle,
  Clock,
  MemoryStick,
  Zap,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react"

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

interface ExecutionPanelProps {
  input: string
  onInputChange: (input: string) => void
  submission: Submission | null
  isRunning: boolean
  onCopyOutput: () => void
}

export function ExecutionPanel({ input, onInputChange, submission, isRunning, onCopyOutput }: ExecutionPanelProps) {
  const [activeTab, setActiveTab] = useState("input")

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "queued":
        return "bg-yellow-500"
      case "running":
        return "bg-blue-500"
      case "completed":
        return "bg-green-500"
      case "error":
        return "bg-red-500"
      case "timeout":
        return "bg-orange-500"
      default:
        return "bg-gray-500"
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 border-b bg-white px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Terminal className="h-4 w-4" />
            <span className="text-sm font-medium">Execution</span>
            {submission && (
              <Badge className={getStatusColor(submission.status)}>
                <div className="flex items-center space-x-1">
                  {getStatusIcon(submission.status)}
                  <span className="capitalize">{submission.status}</span>
                </div>
              </Badge>
            )}
          </div>

          {submission && submission.status === "completed" && (
            <div className="flex items-center space-x-4 text-xs text-gray-500">
              <div className="flex items-center space-x-1">
                <Zap className="h-3 w-3" />
                <span>{submission.executionTime}ms</span>
              </div>
              <div className="flex items-center space-x-1">
                <MemoryStick className="h-3 w-3" />
                <span>{submission.memoryUsage}KB</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="flex-shrink-0 grid w-full grid-cols-4 rounded-none border-b">
            <TabsTrigger value="input" className="flex items-center space-x-1">
              <FileText className="h-3 w-3" />
              <span>Input</span>
            </TabsTrigger>
            <TabsTrigger value="output" className="flex items-center space-x-1">
              <Terminal className="h-3 w-3" />
              <span>Output</span>
            </TabsTrigger>
            <TabsTrigger value="errors" className="flex items-center space-x-1">
              <AlertTriangle className="h-3 w-3" />
              <span>Errors</span>
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center space-x-1">
              <FileText className="h-3 w-3" />
              <span>Logs</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 overflow-hidden">
            <TabsContent value="input" className="h-full m-0 p-4 overflow-auto">
              <div className="h-full flex flex-col space-y-2 min-h-0">
                <div className="flex items-center justify-between flex-shrink-0">
                  <label className="text-sm font-medium">Standard Input (stdin)</label>
                  <span className="text-xs text-gray-500">
                    {input.split("\n").length} lines, {input.length} chars
                  </span>
                </div>
                <Textarea
                  value={input}
                  onChange={(e) => onInputChange(e.target.value)}
                  placeholder="Enter input for your program..."
                  className="flex-1 min-h-0 font-mono text-sm resize-none"
                />
              </div>
            </TabsContent>

            <TabsContent value="output" className="h-full m-0 p-4 overflow-hidden">
              <div className="h-full flex flex-col space-y-2 min-h-0">
                <div className="flex items-center justify-between flex-shrink-0">
                  <label className="text-sm font-medium">Standard Output (stdout)</label>
                  <Button variant="outline" size="sm" onClick={onCopyOutput} disabled={!submission?.output}>
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </div>
                <ScrollArea className="flex-1 min-h-0 border rounded-md">
                  <div className="p-3">
                    {isRunning ? (
                      <div className="flex items-center space-x-2 text-blue-600">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Executing...</span>
                      </div>
                    ) : submission?.output ? (
                      <pre className="text-sm font-mono whitespace-pre-wrap text-green-700 bg-green-50 p-3 rounded">
                        {submission.output}
                      </pre>
                    ) : (
                      <div className="text-gray-500 text-sm italic">No output yet. Run your code to see results.</div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="errors" className="h-full m-0 p-4 overflow-hidden">
              <div className="h-full flex flex-col space-y-2 min-h-0">
                <div className="flex items-center justify-between flex-shrink-0">
                  <label className="text-sm font-medium">Standard Error (stderr)</label>
                  {submission?.exitCode !== undefined && (
                    <Badge variant={submission.exitCode === 0 ? "default" : "destructive"}>
                      Exit Code: {submission.exitCode}
                    </Badge>
                  )}
                </div>
                <ScrollArea className="flex-1 min-h-0 border rounded-md">
                  <div className="p-3">
                    {submission?.stderr ? (
                      <pre className="text-sm font-mono whitespace-pre-wrap text-red-700 bg-red-50 p-3 rounded">
                        {submission.stderr}
                      </pre>
                    ) : submission?.status === "error" ? (
                      <div className="text-red-600 text-sm">Execution failed. Check your code for syntax errors.</div>
                    ) : (
                      <div className="text-gray-500 text-sm italic">No errors detected.</div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="logs" className="h-full m-0 p-4 overflow-hidden">
              <div className="h-full flex flex-col space-y-2 min-h-0">
                <label className="text-sm font-medium flex-shrink-0">Execution Logs</label>
                <ScrollArea className="flex-1 min-h-0 border rounded-md">
                  <div className="p-3 space-y-2">
                    {submission ? (
                      <div className="space-y-1 text-xs font-mono">
                        <div className="text-gray-600">
                          [{new Date(submission.createdAt).toLocaleTimeString()}] Submission created
                        </div>
                        <div className="text-blue-600">
                          [{new Date(submission.createdAt).toLocaleTimeString()}] Added to execution queue
                        </div>
                        {submission.status !== "queued" && (
                          <div className="text-blue-600">[{new Date().toLocaleTimeString()}] Execution started</div>
                        )}
                        {submission.completedAt && (
                          <div className={submission.status === "completed" ? "text-green-600" : "text-red-600"}>
                            [{new Date(submission.completedAt).toLocaleTimeString()}] Execution {submission.status}
                          </div>
                        )}
                        {submission.executionTime && (
                          <div className="text-gray-600">Runtime: {submission.executionTime}ms</div>
                        )}
                        {submission.memoryUsage && (
                          <div className="text-gray-600">Memory: {submission.memoryUsage}KB</div>
                        )}
                      </div>
                    ) : (
                      <div className="text-gray-500 text-sm italic">No execution logs yet.</div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}
