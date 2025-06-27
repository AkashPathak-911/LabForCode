#!/bin/bash

# Test script for CodeLabRunner

echo "🧪 Testing CodeLab Pro platform..."

API_URL="http://localhost:3000"

# Test health endpoint
echo "1. Testing health endpoint..."
curl -s "$API_URL/api/health" | jq .

# Test Python execution
echo "2. Testing Python code execution..."
SUBMISSION=$(curl -s -X POST "$API_URL/api/submissions" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "code": "print(\"Hello from Python!\")\nprint(2 + 2)",
    "input": ""
  }' | jq -r '.id')

echo "Submission ID: $SUBMISSION"

# Wait for completion
sleep 3

# Get result
echo "3. Getting submission result..."
curl -s "$API_URL/api/submissions/$SUBMISSION" | jq .

# Test JavaScript execution
echo "4. Testing JavaScript code execution..."
SUBMISSION_JS=$(curl -s -X POST "$API_URL/api/submissions" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "javascript",
    "code": "console.log(\"Hello from Node.js!\");\nconsole.log(Math.sqrt(16));",
    "input": ""
  }' | jq -r '.id')

echo "JavaScript Submission ID: $SUBMISSION_JS"

# Wait for completion
sleep 3

# Get result
echo "5. Getting JavaScript submission result..."
curl -s "$API_URL/api/submissions/$SUBMISSION_JS" | jq .

# Test with input
echo "6. Testing Python with input..."
SUBMISSION_INPUT=$(curl -s -X POST "$API_URL/api/submissions" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "code": "name = input(\"Enter your name: \")\nprint(f\"Hello, {name}!\")",
    "input": "World"
  }' | jq -r '.id')

echo "Python with input Submission ID: $SUBMISSION_INPUT"

# Wait for completion
sleep 3

# Get result
echo "7. Getting Python with input result..."
curl -s "$API_URL/api/submissions/$SUBMISSION_INPUT" | jq .

# Test compilation (C++)
echo "8. Testing C++ compilation and execution..."
SUBMISSION_CPP=$(curl -s -X POST "$API_URL/api/submissions" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "cpp",
    "code": "#include <iostream>\nusing namespace std;\nint main() {\n    cout << \"Hello from C++!\" << endl;\n    cout << \"5 + 3 = \" << 5 + 3 << endl;\n    return 0;\n}",
    "input": ""
  }' | jq -r '.id')

echo "C++ Submission ID: $SUBMISSION_CPP"

# Wait for completion
sleep 5

# Get result
echo "9. Getting C++ result..."
curl -s "$API_URL/api/submissions/$SUBMISSION_CPP" | jq .

# List all submissions
echo "10. Listing all submissions..."
curl -s "$API_URL/api/submissions" | jq '.[0:3]'

echo "✅ Testing complete!"
