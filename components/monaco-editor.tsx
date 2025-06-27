"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  theme?: string;
  height?: string;
}

// Dynamically import Monaco Editor with SSR disabled
const Editor = dynamic(
  () => import("@monaco-editor/react").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-gray-900 text-white">
        Loading editor...
      </div>
    ),
  }
);

export function MonacoEditor({
  value,
  onChange,
  language,
  theme = "vs-dark",
  height = "100%",
}: MonacoEditorProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900 text-white">
        Loading editor...
      </div>
    );
  }

  // Language mapping for Monaco
  const languageMap: Record<string, string> = {
    python: "python",
    javascript: "javascript",
    java: "java",
    cpp: "cpp",
    c: "c",
    go: "go",
    rust: "rust",
  };

  const monacoLanguage = languageMap[language] || "plaintext";

  // Monaco Editor configuration
  const editorOptions = {
    minimap: { enabled: false },
    fontSize: 14,
    lineNumbers: "on" as const,
    roundedSelection: false,
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    insertSpaces: true,
    wordWrap: "on" as const,
    contextmenu: true,
    selectOnLineNumbers: true,
    glyphMargin: true,
    folding: true,
    foldingHighlight: true,
    showFoldingControls: "always" as const,
    bracketPairColorization: { enabled: true },
    guides: {
      bracketPairs: true,
      indentation: true,
    },
    suggest: {
      showKeywords: true,
      showSnippets: true,
    },
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    // Add custom key bindings
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      // Trigger run command
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("monaco-run"));
      }
    });

    // Focus the editor
    editor.focus();
  };

  return (
    <div className="w-full h-full" style={{ height }}>
      <Editor
        height={height}
        language={monacoLanguage}
        theme={theme}
        value={value}
        onChange={(val) => onChange(val || "")}
        options={editorOptions}
        onMount={handleEditorDidMount}
      />
    </div>
  );
}
