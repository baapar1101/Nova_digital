from __future__ import annotations

import asyncio
import contextlib
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .robot import RobotSimulator


robot = RobotSimulator()


async def simulation_loop() -> None:
    previous = time.monotonic()
    while True:
        now = time.monotonic()
        robot.step(now - previous)
        previous = now
        await asyncio.sleep(0.01)


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(simulation_loop())
    try:
        yield
    finally:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


app = FastAPI(
    title="Nova Digital Twin API",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.get("/api/state")
async def get_state() -> dict:
    return robot.snapshot()


async def send_state(websocket: WebSocket) -> None:
    while True:
        await websocket.send_json(robot.snapshot())
        await asyncio.sleep(1.0 / 30.0)


async def receive_commands(websocket: WebSocket) -> None:
    while True:
        message = await websocket.receive_json()
        message_type = message.get("type")

        if message_type == "joint_target":
            name = str(message.get("joint", ""))
            target = float(message.get("target", 0.0))
            if not robot.set_joint_target(name, target):
                await websocket.send_json(
                    {
                        "type": "error",
                        "message": "Unknown joint: " + name,
                    }
                )

        elif message_type == "home":
            robot.home()

        elif message_type == "estop":
            robot.estop()

        elif message_type == "ping":
            await websocket.send_json({"type": "pong"})


@app.websocket("/ws/robot")
async def robot_websocket(websocket: WebSocket) -> None:
    await websocket.accept()
    sender = asyncio.create_task(send_state(websocket))
    receiver = asyncio.create_task(receive_commands(websocket))

    try:
        done, pending = await asyncio.wait(
            {sender, receiver},
            return_when=asyncio.FIRST_COMPLETED,
        )

        for task in pending:
            task.cancel()

        for task in done:
            task.result()

    except WebSocketDisconnect:
        pass
    except RuntimeError:
        pass
    finally:
        robot.estop()
        sender.cancel()
        receiver.cancel()
