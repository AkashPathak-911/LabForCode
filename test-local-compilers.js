#!/usr/bin/env node

// Quick test of the CodeExecutor with local compilers
const { CodeExecutor } = require("./lib/executor");
const path = require("path");

// Load environment variables
require("dotenv").config({ path: ".env.local" });

async function testCompiler(language, code, expectedOutput) {
  console.log(`\n🧪 Testing ${language}...`);

  try {
    const executor = new CodeExecutor("./tmp", false); // Don't use Docker
    const result = await executor.executeCode(
      language,
      code,
      "",
      "test-" + Date.now()
    );

    if (result.exitCode === 0) {
      const output = result.stdout.trim();
      if (output === expectedOutput) {
        console.log(`✅ ${language}: SUCCESS`);
        console.log(`   Output: "${output}"`);
      } else {
        console.log(`❌ ${language}: WRONG OUTPUT`);
        console.log(`   Expected: "${expectedOutput}"`);
        console.log(`   Got: "${output}"`);
      }
    } else {
      console.log(`❌ ${language}: EXECUTION FAILED`);
      console.log(`   Exit code: ${result.exitCode}`);
      console.log(`   Stderr: ${result.stderr}`);
    }
  } catch (error) {
    console.log(`❌ ${language}: ERROR`);
    console.log(`   ${error.message}`);
  }
}

async function runTests() {
  console.log("🚀 LabForCode Local Compiler Test");
  console.log("==================================");

  // Test cases for available compilers
  const tests = [
    {
      language: "python",
      code: 'print("Hello Python")',
      expected: "Hello Python",
    },
    {
      language: "javascript",
      code: 'console.log("Hello Node.js")',
      expected: "Hello Node.js",
    },
    {
      language: "c",
      code: '#include <stdio.h>\nint main() { printf("Hello C"); return 0; }',
      expected: "Hello C",
    },
    {
      language: "cpp",
      code: '#include <iostream>\nint main() { std::cout << "Hello C++"; return 0; }',
      expected: "Hello C++",
    },
    {
      language: "go",
      code: 'package main\nimport "fmt"\nfunc main() { fmt.Print("Hello Go") }',
      expected: "Hello Go",
    },
    {
      language: "rust",
      code: 'fn main() { print!("Hello Rust"); }',
      expected: "Hello Rust",
    },
  ];

  // Run tests sequentially
  for (const test of tests) {
    await testCompiler(test.language, test.code, test.expected);
  }

  console.log("\n✨ Test complete!");
}

runTests().catch(console.error);
