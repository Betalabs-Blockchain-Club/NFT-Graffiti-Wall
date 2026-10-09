import { defineConfig } from "vitest/config";

// Integration tests share one PostgreSQL database, so files run serially and
// every fixture truncates its tables. Set TEST_DATABASE_URL to point at any
// disposable PostgreSQL instance (CI provides one; local default is the
// docker-compose-style throwaway on port 55432).
export default defineConfig({
  test: {
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
    env: {
      TEST_DATABASE_URL:
        process.env.TEST_DATABASE_URL
        ?? "postgresql://graffiti:graffiti-test@127.0.0.1:55432/graffiti_test"
    }
  }
});
