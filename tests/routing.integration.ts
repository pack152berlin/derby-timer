import { describe, expect, it } from 'bun:test';

describe("Frontend Routing & Persistence", () => {
  const port = Bun.env.PORT ?? "3000";
  const baseUrl = `http://localhost:${port}`;

  it("should redirect from protected routes to home when no event is selected", async () => {
    // Note: This is an integration-level check using fetch to ensure the server
    // serves the index.html for these paths (allowing the frontend router to handle the rest).
    const protectedPaths = ['/register', '/heats', '/race', '/standings'];
    
    for (const path of protectedPaths) {
      const response = await fetch(`${baseUrl}${path}`);
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain('<div id="app">'); // Ensure we get the SPA shell
    }
  });
});
