import { describe, expect, it } from "bun:test";

describe("Real-time Updates (WebSocket)", () => {
  const baseUrl = "http://localhost:3000";
  const wsUrl = "ws://localhost:3000/ws";

  it("should receive a RACERS_UPDATED message when a racer is created", async () => {
    // 1. Create an event first
    const eventResponse = await fetch(`${baseUrl}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "WS Test Event",
        date: "2026-03-01",
        lane_count: 4,
      }),
    });
    const event = await eventResponse.json();
    const eventId = event.id;

    // 2. Connect to WebSocket and wait for it to be ready
    const socket = new WebSocket(wsUrl);
    await new Promise<void>((resolve, reject) => {
      socket.onopen = () => resolve();
      socket.onerror = reject;
    });

    const messagePromise = new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("WebSocket message timeout")), 5000);
      socket.onmessage = (msg) => {
        clearTimeout(timeout);
        resolve(JSON.parse(msg.data));
        socket.close();
      };
      socket.onerror = (err) => {
        clearTimeout(timeout);
        reject(err);
      };
    });

    // 3. Create a racer to trigger broadcast
    await fetch(`${baseUrl}/api/events/${eventId}/racers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "WS Scout",
      }),
    });

    // 4. Verify message
    const message = await messagePromise;
    expect(message.type).toBe("RACERS_UPDATED");
    expect(message.eventId).toBe(eventId);
  });
});
