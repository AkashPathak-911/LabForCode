"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Separator } from "@/components/ui/separator";
import {
  Play,
  Square,
  Copy,
  Share2,
  History,
  Loader2,
  Terminal,
  Code,
  FileText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MonacoEditor } from "@/components/monaco-editor";
import { SimpleEditor } from "@/components/simple-editor";
import { ErrorBoundary } from "@/components/error-boundary";
import { ExecutionPanel } from "@/components/execution-panel";
import { HistoryPanel } from "@/components/history-panel";
import { ShareDialog } from "@/components/share-dialog";

const LANGUAGES = [
  {
    id: "python",
    name: "Python 3.11",
    extension: "py",
    template: `# Python 3.11
print("Hello, World!")

# Interactive input example
name = input("Enter your name: ")
print(f"Hello, {name}!")

# Math example
import math
print(f"Square root of 16: {math.sqrt(16)}")`,
    command: "python3",
  },
  {
    id: "javascript",
    name: "Node.js 18",
    extension: "js",
    template: `// Node.js 18
console.log("Hello, World!");

// Interactive input example
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Enter your name: ', (name) => {
  console.log(\`Hello, \${name}!\`);
  
  // Math example
  console.log(\`Square root of 16: \${Math.sqrt(16)}\`);
  rl.close();
});`,
    command: "node",
  },
  {
    id: "java",
    name: "Java 17",
    extension: "java",
    template: `// Java 17
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
        
        // Interactive input example
        Scanner scanner = new Scanner(System.in);
        System.out.print("Enter your name: ");
        String name = scanner.nextLine();
        System.out.println("Hello, " + name + "!");
        
        // Math example
        System.out.println("Square root of 16: " + Math.sqrt(16));
        scanner.close();
    }
}`,
    command: "javac Main.java && java Main",
  },
  {
    id: "cpp",
    name: "C++ 17",
    extension: "cpp",
    template: `// C++ 17
#include <iostream>
#include <string>
#include <cmath>

int main() {
    std::cout << "Hello, World!" << std::endl;
    
    // Interactive input example
    std::string name;
    std::cout << "Enter your name: ";
    std::getline(std::cin, name);
    std::cout << "Hello, " << name << "!" << std::endl;
    
    // Math example
    std::cout << "Square root of 16: " << std::sqrt(16) << std::endl;
    
    return 0;
}`,
    command: "g++ -o main main.cpp && ./main",
  },
  {
    id: "c",
    name: "C 17",
    extension: "c",
    template: `// C 17
#include <stdio.h>
#include <string.h>
#include <math.h>

int main() {
    printf("Hello, World!\\n");
    
    // Interactive input example
    char name[100];
    printf("Enter your name: ");
    fgets(name, sizeof(name), stdin);
    name[strcspn(name, "\\n")] = 0; // Remove newline
    printf("Hello, %s!\\n", name);
    
    // Math example
    printf("Square root of 16: %.2f\\n", sqrt(16));
    
    return 0;
}`,
    command: "gcc -o main main.c -lm && ./main",
  },
  {
    id: "go",
    name: "Go 1.21",
    extension: "go",
    template: `// Go 1.21
package main

import (
    "bufio"
    "fmt"
    "math"
    "os"
    "strings"
)

func main() {
    fmt.Println("Hello, World!")
    
    // Interactive input example
    reader := bufio.NewReader(os.Stdin)
    fmt.Print("Enter your name: ")
    name, _ := reader.ReadString('\\n')
    name = strings.TrimSpace(name)
    fmt.Printf("Hello, %s!\\n", name)
    
    // Math example
    fmt.Printf("Square root of 16: %.2f\\n", math.Sqrt(16))
}`,
    command: "go run main.go",
  },
  {
    id: "rust",
    name: "Rust 1.70",
    extension: "rs",
    template: `// Rust 1.70
use std::io;

fn main() {
    println!("Hello, World!");
    
    // Interactive input example
    println!("Enter your name: ");
    let mut name = String::new();
    io::stdin().read_line(&mut name).expect("Failed to read line");
    let name = name.trim();
    println!("Hello, {}!", name);
    
    // Math example
    println!("Square root of 16: {:.2}", (16.0_f64).sqrt());
}`,
    command: "rustc main.rs && ./main",
  },
];

interface Submission {
  id: string;
  language: string;
  code: string;
  input: string;
  status: "queued" | "running" | "completed" | "error" | "timeout";
  output?: string;
  stderr?: string;
  executionTime?: number;
  memoryUsage?: number;
  exitCode?: number;
  createdAt: string;
  completedAt?: string;
  shareId?: string;
}

export default function CodeExecutionPlatform() {
  const [selectedLanguage, setSelectedLanguage] = useState("python");
  const [code, setCode] = useState("");
  const [input, setInput] = useState("Alice");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [currentSubmission, setCurrentSubmission] = useState<Submission | null>(
    null
  );
  const [isRunning, setIsRunning] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [useSimpleEditor, setUseSimpleEditor] = useState(false);
  const { toast } = useToast();
  const eventSourceRef = useRef<EventSource | null>(null);

  // Initialize code template when language changes
  useEffect(() => {
    const language = LANGUAGES.find((l) => l.id === selectedLanguage);
    if (language) {
      setCode(language.template);
    }
  }, [selectedLanguage]);

  // Load submissions from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("judge0-submissions");
    if (saved) {
      try {
        setSubmissions(JSON.parse(saved));
      } catch (error) {
        console.error("Failed to load submissions:", error);
      }
    }
  }, []);

  // Save submissions to localStorage
  useEffect(() => {
    localStorage.setItem("judge0-submissions", JSON.stringify(submissions));
  }, [submissions]);

  // Listen for custom run events from editors
  useEffect(() => {
    const handleEditorRun = () => {
      if (!isRunning) {
        handleRun();
      }
    };

    window.addEventListener("monaco-run", handleEditorRun);
    return () => window.removeEventListener("monaco-run", handleEditorRun);
  }, [isRunning]);

  const handleRun = async () => {
    if (!code.trim()) {
      toast({
        title: "Error",
        description: "Please enter some code to execute",
        variant: "destructive",
      });
      return;
    }

    setIsRunning(true);
    setCurrentSubmission(null);

    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language: selectedLanguage,
          code,
          input,
        }),
      });

      if (response.ok) {
        const submission = await response.json();
        setCurrentSubmission(submission);
        setSubmissions((prev) => [submission, ...prev.slice(0, 49)]); // Keep last 50

        // Start streaming results
        startStreaming(submission.id);

        toast({
          title: "Success",
          description: "Code submitted for execution",
        });
      } else {
        throw new Error("Failed to submit code");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit code for execution",
        variant: "destructive",
      });
      setIsRunning(false);
    }
  };

  const handleStop = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (currentSubmission) {
      // Send stop request
      fetch(`/api/submissions/${currentSubmission.id}/stop`, {
        method: "POST",
      });
    }

    setIsRunning(false);
  };

  const startStreaming = (submissionId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    eventSourceRef.current = new EventSource(
      `/api/submissions/${submissionId}/stream`
    );

    eventSourceRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "status") {
        setCurrentSubmission((prev) =>
          prev ? { ...prev, ...data.submission } : data.submission
        );
        setSubmissions((prev) =>
          prev.map((s) =>
            s.id === submissionId ? { ...s, ...data.submission } : s
          )
        );

        if (
          data.submission.status === "completed" ||
          data.submission.status === "error" ||
          data.submission.status === "timeout"
        ) {
          setIsRunning(false);
          eventSourceRef.current?.close();
        }
      }
    };

    eventSourceRef.current.onerror = () => {
      setIsRunning(false);
      eventSourceRef.current?.close();
    };
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied",
      description: "Code copied to clipboard",
    });
  };

  const handleCopyOutput = () => {
    if (currentSubmission?.output) {
      navigator.clipboard.writeText(currentSubmission.output);
      toast({
        title: "Copied",
        description: "Output copied to clipboard",
      });
    }
  };

  const handleShare = () => {
    setShowShare(true);
  };

  const handleLoadSubmission = (submission: Submission) => {
    setSelectedLanguage(submission.language);
    setCode(submission.code);
    setInput(submission.input);
    setCurrentSubmission(submission);
    setShowHistory(false);
  };

  const currentLanguage = LANGUAGES.find((l) => l.id === selectedLanguage);

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Header - Fixed height */}
      <div className="flex-shrink-0 border-b bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Terminal className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-bold">CodeRunner Pro</h1>
            </div>

            <Select
              value={selectedLanguage}
              onValueChange={setSelectedLanguage}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.id} value={lang.id}>
                    <div className="flex items-center space-x-2">
                      <Code className="h-4 w-4" />
                      <span>{lang.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUseSimpleEditor(!useSimpleEditor)}
              title={
                useSimpleEditor
                  ? "Switch to Monaco Editor"
                  : "Switch to Simple Editor"
              }
            >
              <Code className="h-4 w-4 mr-2" />
              {useSimpleEditor ? "Monaco" : "Simple"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHistory(true)}
            >
              <History className="h-4 w-4 mr-2" />
              History
            </Button>

            <Button variant="outline" size="sm" onClick={handleCopyCode}>
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>

            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>

            <Separator orientation="vertical" className="h-6" />

            <Button
              onClick={isRunning ? handleStop : handleRun}
              disabled={!code.trim()}
              className={
                isRunning
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-green-600 hover:bg-green-700"
              }
            >
              {isRunning ? (
                <>
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content - Takes remaining height */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Code Editor Panel */}
          <ResizablePanel defaultSize={60} minSize={40}>
            <div className="h-full flex flex-col overflow-hidden">
              <div className="flex-shrink-0 border-b bg-white px-4 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      main.{currentLanguage?.extension}
                    </span>
                    {isRunning && (
                      <Badge variant="secondary" className="animate-pulse">
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Running
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {currentLanguage?.name}
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-hidden">
                <ErrorBoundary
                  fallback={
                    <SimpleEditor
                      value={code}
                      onChange={setCode}
                      language={selectedLanguage}
                      className="h-full"
                    />
                  }
                  onError={() => setUseSimpleEditor(true)}
                >
                  {useSimpleEditor ? (
                    <SimpleEditor
                      value={code}
                      onChange={setCode}
                      language={selectedLanguage}
                      className="h-full"
                    />
                  ) : (
                    <MonacoEditor
                      value={code}
                      onChange={setCode}
                      language={selectedLanguage}
                      theme="vs-dark"
                    />
                  )}
                </ErrorBoundary>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Execution Panel */}
          <ResizablePanel defaultSize={40} minSize={30}>
            <ExecutionPanel
              input={input}
              onInputChange={setInput}
              submission={currentSubmission}
              isRunning={isRunning}
              onCopyOutput={handleCopyOutput}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Dialogs remain the same */}
      <HistoryPanel
        open={showHistory}
        onOpenChange={setShowHistory}
        submissions={submissions}
        onLoadSubmission={handleLoadSubmission}
        languages={LANGUAGES}
      />

      <ShareDialog
        open={showShare}
        onOpenChange={setShowShare}
        code={code}
        language={selectedLanguage}
        input={input}
      />
    </div>
  );
}
