import { NextResponse } from "next/server";
import { database } from "@/lib/database";

interface DiagnosticCheck {
  name: string;
  status: string;
  message: string;
}

export async function GET() {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    database: {
      url: process.env.DATABASE_URL ? "configured" : "not configured",
      connection: "unknown",
    },
    redis: {
      url: process.env.REDIS_URL ? "configured" : "not configured",
    },
    checks: [] as DiagnosticCheck[],
  };

  // Test database connection using healthCheck method
  try {
    const healthResult = await database.healthCheck();
    diagnostics.database.connection = healthResult.connected
      ? "connected"
      : "failed";
    diagnostics.checks.push({
      name: "database_connection",
      status: healthResult.connected ? "success" : "error",
      message: healthResult.connected
        ? "Database connected"
        : "Database connection failed",
    });
  } catch (error) {
    diagnostics.database.connection = "failed";
    diagnostics.checks.push({
      name: "database_connection",
      status: "error",
      message:
        error instanceof Error ? error.message : "Unknown database error",
    });
  }
  // Test if we can get submissions (this will test table existence)
  try {
    const submissions = await database.getSubmissions();
    diagnostics.checks.push({
      name: "submissions_table",
      status: "success",
      message: `Submissions table exists with ${submissions.submissions.length} records`,
    });
  } catch (error) {
    diagnostics.checks.push({
      name: "submissions_table",
      status: "error",
      message: "Submissions table not found - database may need initialization",
    });
  }

  // Test statistics query
  try {
    const stats = await database.getStatistics();
    diagnostics.checks.push({
      name: "statistics",
      status: stats.status === "error" ? "warning" : "success",
      message:
        stats.status === "error" ? stats.error : "Statistics query successful",
    });
  } catch (error) {
    diagnostics.checks.push({
      name: "statistics",
      status: "error",
      message:
        error instanceof Error ? error.message : "Statistics query failed",
    });
  }

  return NextResponse.json(diagnostics);
}
