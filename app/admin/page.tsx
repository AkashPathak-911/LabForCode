"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Activity, Server, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react"

interface SystemStats {
  totalSubmissions: number
  queuedSubmissions: number
  runningSubmissions: number
  completedSubmissions: number
  errorSubmissions: number
  averageExecutionTime: number
  systemLoad: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<SystemStats>({
    totalSubmissions: 0,
    queuedSubmissions: 0,
    runningSubmissions: 0,
    completedSubmissions: 0,
    errorSubmissions: 0,
    averageExecutionTime: 0,
    systemLoad: 0,
  })
  const [submissions, setSubmissions] = useState([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/submissions")
        if (response.ok) {
          const data = await response.json()
          setSubmissions(data)

          // Calculate stats
          const total = data.length
          const queued = data.filter((s: any) => s.status === "queued").length
          const running = data.filter((s: any) => s.status === "running").length
          const completed = data.filter((s: any) => s.status === "completed").length
          const error = data.filter((s: any) => s.status === "error").length

          const completedWithTime = data.filter((s: any) => s.status === "completed" && s.executionTime)
          const avgTime =
            completedWithTime.length > 0
              ? completedWithTime.reduce((sum: number, s: any) => sum + s.executionTime, 0) / completedWithTime.length
              : 0

          setStats({
            totalSubmissions: total,
            queuedSubmissions: queued,
            runningSubmissions: running,
            completedSubmissions: completed,
            errorSubmissions: error,
            averageExecutionTime: Math.round(avgTime),
            systemLoad: Math.random() * 100, // Simulated system load
          })
        }
      } catch (error) {
        console.error("Error fetching data:", error)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 2000)
    return () => clearInterval(interval)
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "queued":
        return <Clock className="h-4 w-4" />
      case "running":
        return <Loader2 className="h-4 w-4 animate-spin" />
      case "completed":
        return <CheckCircle className="h-4 w-4" />
      case "error":
        return <XCircle className="h-4 w-4" />
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Monitor your code execution platform</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSubmissions}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Queue Length</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.queuedSubmissions}</div>
              <p className="text-xs text-muted-foreground">{stats.runningSubmissions} running</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalSubmissions > 0
                  ? Math.round((stats.completedSubmissions / stats.totalSubmissions) * 100)
                  : 0}
                %
              </div>
              <p className="text-xs text-muted-foreground">{stats.errorSubmissions} errors</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Execution Time</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averageExecutionTime}ms</div>
              <p className="text-xs text-muted-foreground">System load: {Math.round(stats.systemLoad)}%</p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed View */}
        <Card>
          <CardHeader>
            <CardTitle>System Overview</CardTitle>
            <CardDescription>Real-time monitoring of code execution platform</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="submissions" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="submissions">Recent Submissions</TabsTrigger>
                <TabsTrigger value="performance">Performance</TabsTrigger>
                <TabsTrigger value="system">System Health</TabsTrigger>
              </TabsList>

              <TabsContent value="submissions" className="mt-6">
                <div className="space-y-4 max-h-[400px] overflow-y-auto">
                  {submissions.slice(0, 10).map((submission: any) => (
                    <div key={submission.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(submission.status)}
                          <Badge variant="outline">{submission.language}</Badge>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Submission {submission.id.slice(0, 8)}</p>
                          <p className="text-xs text-gray-500">{new Date(submission.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
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
                        {submission.executionTime && (
                          <p className="text-xs text-gray-500 mt-1">{submission.executionTime}ms</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="performance" className="mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Execution Times</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Average:</span>
                          <span>{stats.averageExecutionTime}ms</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Queue Processing:</span>
                          <span className="text-green-600">Normal</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Language Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {["python", "javascript", "java", "cpp"].map((lang) => {
                          const count = submissions.filter((s: any) => s.language === lang).length
                          return (
                            <div key={lang} className="flex justify-between">
                              <span className="capitalize">{lang}:</span>
                              <span>{count}</span>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="system" className="mt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">API Server</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span>Healthy</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Job Queue</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span>Processing</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Workers</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span>1 Active</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
