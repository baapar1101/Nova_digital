# Nova Digital Twin

Web + Python digital-twin prototype for the Nova robot.

Current powered head axes:

- Pan: 180° total travel, represented as -90° to +90° around center.
- Tilt: 0° (home/base position) to +45°.

The browser is the visualization/control layer. Python owns the head state and sends it over WebSocket at about 30 Hz.

## Stack

- React + Vite
- Three.js / React Three Fiber
- FastAPI
- WebSocket
- Real Nova GLB geometry exported from Rhino
- Velocity- and acceleration-limited pan/tilt motion simulator

## Run

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

If Python runs on another machine, set VITE_ROBOT_WS_URL in frontend/.env.local.

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

Rhino exported thousands of glTF primitives. The viewer merges those primitives at runtime inside each rigid assembly to reduce draw calls while preserving the CAD shape.

The initial neck pivot in frontend/src/components/RobotScene.jsx is:

~~~js
const HEAD_PIVOT = new THREE.Vector3(0, 0.052, 0)
~~~

Units are meters. This is an initial estimate from the supplied geometry. Replace it with the exact bearing/tilt-axis coordinate when that measurement is available.

## Next steps

1. Calibrate the exact physical pivot.
2. Confirm tilt direction and zero against the physical robot.
3. Map Python targets to the real motor controller.
4. Feed encoder feedback back into the same WebSocket state.
5. Add face/display simulation, LEDs, audio, sensors and fault states.
6. Add command ownership, hardware limits/watchdogs and the real safety path before remote actuation.
