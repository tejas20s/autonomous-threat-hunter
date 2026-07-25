"""
Real-time monitoring via Server-Sent Events (SSE).

Streams new alerts, status changes, and system events to connected
dashboard clients without polling.
"""

import asyncio
import json
from datetime import datetime
from typing import Optional

from fastapi import Request
from fastapi.responses import StreamingResponse


class SSEManager:
    """Manages SSE connections and broadcasts events to all clients."""

    def __init__(self):
        self._subscribers: list[asyncio.Queue] = []

    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue()
        self._subscribers.append(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue):
        if queue in self._subscribers:
            self._subscribers.remove(queue)

    async def broadcast(self, event: str, data: dict):
        """Send an event to all connected clients."""
        payload = json.dumps({"event": event, "data": data, "timestamp": datetime.utcnow().isoformat()})
        dead_queues = []
        for queue in self._subscribers:
            try:
                await queue.put(f"event: {event}\ndata: {payload}\n\n")
            except Exception:
                dead_queues.append(queue)
        for q in dead_queues:
            self.unsubscribe(q)

    async def stream(self, request: Request):
        """Generate SSE stream for a client."""
        queue = self.subscribe()
        try:
            # Send initial keepalive
            yield f"event: connected\ndata: {json.dumps({'status': 'connected'})}\n\n"
            while True:
                try:
                    # Check if client disconnected
                    if await request.is_disconnected():
                        break
                    # Wait for messages with timeout
                    msg = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield msg
                except asyncio.TimeoutError:
                    # Send keepalive ping
                    yield f"event: ping\ndata: {json.dumps({'time': datetime.utcnow().isoformat()})}\n\n"
        finally:
            self.unsubscribe(queue)


# Singleton SSE manager
sse_manager = SSEManager()


async def notify_new_alert(alert: dict):
    """Broadcast a new alert to all connected dashboards."""
    await sse_manager.broadcast("new_alert", alert)


async def notify_alert_update(alert_id: str, update: dict):
    """Broadcast an alert status change."""
    await sse_manager.broadcast("alert_update", {"alert_id": alert_id, **update})


async def notify_system_event(event_type: str, data: dict):
    """Broadcast a system event (training complete, etc.)."""
    await sse_manager.broadcast("system_event", {"type": event_type, **data})
