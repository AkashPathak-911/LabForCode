import { NextResponse } from "next/server";

/**
 * Judge0 Compatible Languages Endpoint
 *
 * Returns the list of supported languages in Judge0 format
 */

export async function GET() {
  try {
    // Judge0 compatible language list
    const languages = [
      {
        id: 45,
        name: "Assembly (NASM 2.14.02)",
        is_archived: false,
        source_file: "main.asm",
        compile_cmd: "nasm -f elf64 main.asm && ld main.o -o main",
        run_cmd: "./main",
      },
      {
        id: 46,
        name: "Bash (5.0.0)",
        is_archived: false,
        source_file: "script.sh",
        compile_cmd: null,
        run_cmd: "bash script.sh",
      },
      {
        id: 48,
        name: "C (GCC 7.4.0)",
        is_archived: false,
        source_file: "main.c",
        compile_cmd: "gcc main.c -o main",
        run_cmd: "./main",
      },
      {
        id: 50,
        name: "C (GCC 9.4.0)",
        is_archived: false,
        source_file: "main.c",
        compile_cmd: "gcc main.c -o main -std=c17 -lm",
        run_cmd: "./main",
      },
      {
        id: 51,
        name: "C# (Mono 6.6.0.161)",
        is_archived: false,
        source_file: "Main.cs",
        compile_cmd: "mcs Main.cs",
        run_cmd: "mono Main.exe",
      },
      {
        id: 52,
        name: "C++ (GCC 7.4.0)",
        is_archived: false,
        source_file: "main.cpp",
        compile_cmd: "g++ main.cpp -o main",
        run_cmd: "./main",
      },
      {
        id: 54,
        name: "C++ (GCC 9.4.0)",
        is_archived: false,
        source_file: "main.cpp",
        compile_cmd: "g++ main.cpp -o main -std=c++17",
        run_cmd: "./main",
      },
      {
        id: 60,
        name: "Go (1.13.5)",
        is_archived: false,
        source_file: "main.go",
        compile_cmd: null,
        run_cmd: "go run main.go",
      },
      {
        id: 62,
        name: "Java (OpenJDK 13.0.1)",
        is_archived: false,
        source_file: "Main.java",
        compile_cmd: "javac Main.java",
        run_cmd: "java Main",
      },
      {
        id: 63,
        name: "JavaScript (Node.js 12.14.0)",
        is_archived: false,
        source_file: "script.js",
        compile_cmd: null,
        run_cmd: "node script.js",
      },
      {
        id: 70,
        name: "Python (2.7.17)",
        is_archived: false,
        source_file: "script.py",
        compile_cmd: null,
        run_cmd: "python2 script.py",
      },
      {
        id: 71,
        name: "Python (3.8.1)",
        is_archived: false,
        source_file: "script.py",
        compile_cmd: null,
        run_cmd: "python3 script.py",
      },
      {
        id: 72,
        name: "Ruby (2.7.0)",
        is_archived: false,
        source_file: "script.rb",
        compile_cmd: null,
        run_cmd: "ruby script.rb",
      },
      {
        id: 73,
        name: "Rust (1.40.0)",
        is_archived: false,
        source_file: "main.rs",
        compile_cmd: "rustc main.rs -o main",
        run_cmd: "./main",
      },
      {
        id: 74,
        name: "TypeScript (3.7.4)",
        is_archived: false,
        source_file: "script.ts",
        compile_cmd: "tsc script.ts",
        run_cmd: "node script.js",
      },
    ];

    return NextResponse.json(languages);
  } catch (error) {
    console.error("Failed to fetch languages:", error);
    return NextResponse.json(
      { error: "Failed to fetch languages" },
      { status: 500 }
    );
  }
}
