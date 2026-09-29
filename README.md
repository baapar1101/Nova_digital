# Nova Digital Twin

Web + Python digital-twin prototype for the Nova robot.

Current powered head axes:

- Pan: 180° total travel, represented as -90° to +90° around center.
- Tilt: 0° (home/base position) to +45°.
- Both pan and tilt rotate through the geometric center of the spherical head.

The browser is the visualization/control layer. Python owns the real head state when a backend is connected and sends it over WebSocket at about 30 Hz.

For public frontend deployments without a backend URL, the UI automatically enters **WEB DEMO** mode. That makes the Vercel build interactive while preserving the same control/state shape used by Python.

## Stack

- React + Vite
- Three.js / React Three Fiber
- FastAPI
- WebSocket
- Real Nova GLB geometry exported from Rhino
- Velocity- and acceleration-limited pan/tilt motion model

## Run locally

Backend:

~~~bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
~~~

Frontend:

~~~bash
cd frontend
npm install
npm run dev
~~~

Open http://localhost:5173.

Local frontend builds automatically try ws://localhost:8000/ws/robot.

## Vercel

The repository contains a root vercel.json, so importing the repository into Vercel builds the frontend directly.

Without VITE_ROBOT_WS_URL, the deployed site uses WEB DEMO mode.

To connect a deployed frontend to the Python backend, set:

~~~text
VITE_ROBOT_WS_URL=wss://your-public-backend.example/ws/robot
~~~

The public site should use WSS, not an insecure ws:// endpoint.

## Motion protocol

Browser to Python:

~~~json
{"type":"joint_target","joint":"head_pan","target":0.785398}
~~~

Angles are radians. Valid joints are head_pan and head_tilt.

Home:

~~~json
{"type":"home"}
~~~

Stop at the current position:

~~~json
{"type":"estop"}
~~~

## CAD / model

The viewer uses the supplied Rhino exports as four rigid assemblies:

- nova-base.glb
- nova-body.glb
- nova-head.glb
- nova-glass.glb

The head shell and front glass are parented together and receive the same pan/tilt transform.

Rhino exported many glTF primitives. The viewer merges those primitives at runtime inside each rigid assembly to reduce draw calls while preserving the CAD shape.

The spherical outer head shell was fitted directly from the Rhino-exported mesh. Its center is:

~~~js
const HEAD_SPHERE_CENTER = new THREE.Vector3(0, 0.09616257, 0)
~~~

The fitted outer radius is approximately 0.046323 m.

Pan rotates around the vertical Y axis through this point. Tilt rotates around the Z axis through the same point. This makes the head rotate around the sphere center rather than swing around the neck/base.

## Next steps

1. Confirm tilt sign/direction against the physical robot.
2. Host the Python WebSocket service at a public WSS endpoint.
3. Map Python targets to the real motor controller.
4. Feed encoder feedback back into the same WebSocket state.
5. Add face/display simulation, LEDs, audio, sensors and fault states.
6. Add command ownership, hardware limits/watchdogs and the real safety path before remote actuation.
