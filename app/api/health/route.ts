import { NextResponse } from "next/server";

// Lazy imports to prevent issues during build
const getDatabaseHealth = async () => {
  try {
    const { database } = await import("@/lib/database");
    return await database.healthCheck();
  } catch (error) {
    return {
      status: "unavailable",
      timestamp: new Date().toISOString(),
      connected: false,
      error: "Database module not available",
    };
  }
};

const getQueueHealth = async () => {
  try {
    const { getQueueStats } = await import("@/lib/queue");
    return await getQueueStats();
  } catch (error) {
    return {
      status: "unavailable",
      error: "Queue module not available",
    };
  }
};

export async function GET() {
  try {
    // Check database health
    const dbHealth = await getDatabaseHealth();

    // Check queue health
    const queueStats = await getQueueHealth();

    // Check system resources
    const systemInfo = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version,
      env: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    };

    const isHealthy =
      dbHealth.status === "healthy" || dbHealth.status === "unavailable";

    return NextResponse.json(
      {
        status: isHealthy ? "healthy" : "unhealthy",
        timestamp: new Date().toISOString(),
        database: dbHealth,
        queue: queueStats,
        system: systemInfo,
      },
      {
        status: isHealthy ? 200 : 503,
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          version: process.version,
          env: process.env.NODE_ENV,
        },
      },
      {
        status: 503,
      }
    );
  }
}
