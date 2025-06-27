"use client";

import { useEffect, useRef } from "react";

interface SimpleEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  className?: string;
}

export function SimpleEditor({
  value,
  onChange,
  language,
  className = "",
}: SimpleEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current && textareaRef.current.value !== value) {
      textareaRef.current.value = value;
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle tab key for indentation
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = value.substring(0, start) + "  " + value.substring(end);
      onChange(newValue);

      // Set cursor position after the inserted spaces
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }

    // Handle Ctrl+Enter for run command
    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("monaco-run"));
      }
    }
  };

  return (
    <div className={`relative w-full h-full ${className}`}>
      <div className="absolute top-2 right-2 text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">
        {language}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className="w-full h-full p-4 bg-gray-900 text-gray-100 font-mono text-sm resize-none outline-none border-none"
        style={{
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
          lineHeight: "1.5",
          tabSize: 2,
        }}
        placeholder="Enter your code here..."
        spellCheck={false}
      />
    </div>
  );
}
