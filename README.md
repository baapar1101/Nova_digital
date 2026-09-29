# Nova Digital Twin

Initial digital-twin prototype for the Nova robot.

This repository starts with a working vertical slice:

- **Web frontend:** React + Three.js via React Three Fiber
- **Python backend:** FastAPI
- **Realtime link:** WebSocket
- **Simulation:** lightweight differential-drive + articulated-joint state simulator
- **Controls:** W/A/S/D or arrow keys, Space for stop
- **Telemetry:** pose, speed, track commands, arm joint state, battery, connection status

The first version intentionally uses a procedural placeholder robot so the software can run before the final GLB/URDF/MJCF assets are wired in. The backend interface is designed so the simple simulator can later be replaced by MuJoCo/ROS 2 without changing the browser protocol.

## Run locally

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend endpoints:

- `GET http://localhost:8000/health`
- `GET http://localhost:8000/api/state`
- `WS  ws://localhost:8000/ws/robot`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal, normally `http://localhost:5173`.

If the backend is on another machine, create `frontend/.env.local`:

```env
VITE_ROBOT_WS_URL=ws://192.168.1.50:8000/ws/robot
```

## Controls

| Input | Action |
| --- | --- |
| W / Arrow Up | Forward |
| S / Arrow Down | Reverse |
| A / Arrow Left | Turn left |
| D / Arrow Right | Turn right |
| Space | Stop |

## Protocol

Browser -> Python:

```json
{"type":"drive","left":0.7,"right":0.7}
```

```json
{"type":"estop"}
```

Python -> Browser:

```json
{
  "type": "state",
  "seq": 42,
  "timestamp": 0.0,
  "pose": {"x": 0.0, "y": 0.0, "z": 0.0, "yaw": 0.0},
  "velocity": {"linear": 0.0, "angular": 0.0},
  "tracks": {"left": 0.0, "right": 0.0},
  "joints": {
    "arm_base": 0.0,
    "shoulder": 0.0,
    "elbow": 0.0,
    "wrist": 0.0
  },
  "battery": 100.0
}
```

## Next engineering steps

1. Export the production robot mesh as GLB with stable part/joint names.
2. Add a robot configuration file mapping GLB node names to physical joints.
3. Build the MuJoCo model with real dimensions, joint limits, masses and actuators.
4. Replace the kinematic simulator with a MuJoCo adapter while retaining the WebSocket state schema.
5. Add camera/LiDAR/IMU telemetry and ROS 2 integration.
6. Add command authorization, watchdogs and a hardware E-stop path before controlling the real robot.

