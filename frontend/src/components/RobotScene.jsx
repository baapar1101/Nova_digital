import { Grid, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

function JointMarker() {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.09, 0.09, 0.16, 24]} />
      <meshStandardMaterial color="#dce3ea" metalness={0.5} roughness={0.3} />
    </mesh>
  )
}

function ArmSegment({ length, thickness = 0.13 }) {
  return (
    <mesh position={[length / 2, 0, 0]} castShadow receiveShadow>
      <boxGeometry args={[length, thickness, thickness]} />
      <meshStandardMaterial color="#f3f5f7" metalness={0.18} roughness={0.34} />
    </mesh>
  )
}

function RobotBody({ state }) {
  const root = useRef()
  const armBase = useRef()
  const shoulder = useRef()
  const elbow = useRef()
  const wrist = useRef()

  useFrame((_, delta) => {
    if (!root.current) return

    const lambda = 14
    root.current.position.x = THREE.MathUtils.damp(
      root.current.position.x,
      state.pose.x,
      lambda,
      delta,
    )
    root.current.position.z = THREE.MathUtils.damp(
      root.current.position.z,
      state.pose.z,
      lambda,
      delta,
    )
    root.current.rotation.y = THREE.MathUtils.damp(
      root.current.rotation.y,
      -state.pose.yaw,
      lambda,
      delta,
    )

    if (armBase.current) {
      armBase.current.rotation.y = THREE.MathUtils.damp(
        armBase.current.rotation.y,
        -state.joints.arm_base,
        lambda,
        delta,
      )
    }

    if (shoulder.current) {
      shoulder.current.rotation.z = THREE.MathUtils.damp(
        shoulder.current.rotation.z,
        state.joints.shoulder,
        lambda,
        delta,
      )
    }

    if (elbow.current) {
      elbow.current.rotation.z = THREE.MathUtils.damp(
        elbow.current.rotation.z,
        state.joints.elbow,
        lambda,
        delta,
      )
    }

    if (wrist.current) {
      wrist.current.rotation.z = THREE.MathUtils.damp(
        wrist.current.rotation.z,
        state.joints.wrist,
        lambda,
        delta,
      )
    }
  })

  return (
    <group ref={root} position={[0, 0.25, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.45, 0.36, 0.86]} />
        <meshStandardMaterial color="#eef1f4" metalness={0.12} roughness={0.32} />
      </mesh>

      <mesh position={[-0.18, 0.31, 0]} castShadow>
        <boxGeometry args={[0.72, 0.28, 0.66]} />
        <meshStandardMaterial color="#d9dee3" metalness={0.18} roughness={0.36} />
      </mesh>

      <mesh position={[0, -0.13, 0.54]} castShadow receiveShadow>
        <boxGeometry args={[1.56, 0.28, 0.20]} />
        <meshStandardMaterial color="#252a31" metalness={0.08} roughness={0.78} />
      </mesh>

      <mesh position={[0, -0.13, -0.54]} castShadow receiveShadow>
        <boxGeometry args={[1.56, 0.28, 0.20]} />
        <meshStandardMaterial color="#252a31" metalness={0.08} roughness={0.78} />
      </mesh>

      <group ref={armBase} position={[0.22, 0.46, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.22, 0.25, 0.16, 32]} />
          <meshStandardMaterial color="#d7dce2" metalness={0.3} roughness={0.28} />
        </mesh>

        <group ref={shoulder} position={[0, 0.12, 0]}>
          <JointMarker />
          <ArmSegment length={0.72} />
          <group ref={elbow} position={[0.72, 0, 0]}>
            <JointMarker />
            <ArmSegment length={0.60} thickness={0.11} />
            <group ref={wrist} position={[0.60, 0, 0]}>
              <JointMarker />
              <ArmSegment length={0.24} thickness={0.09} />
              <mesh position={[0.30, 0, 0]} castShadow>
                <boxGeometry args={[0.18, 0.18, 0.22]} />
                <meshStandardMaterial
                  color="#8fd3ff"
                  emissive="#16394d"
                  metalness={0.15}
                  roughness={0.28}
                />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}

export default function RobotScene({ state }) {
  return (
    <Canvas
      shadows
      camera={{ position: [4.8, 3.2, 4.8], fov: 42, near: 0.1, far: 100 }}
      dpr={[1, 2]}
    >
      <color attach="background" args={['#090c11']} />
      <fog attach="fog" args={['#090c11', 8, 24]} />

      <ambientLight intensity={0.7} />
      <directionalLight
        castShadow
        position={[5, 8, 4]}
        intensity={2.2}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight position={[-4, 3, -2]} intensity={0.55} />

      <RobotBody state={state} />

      <Grid
        args={[40, 40]}
        cellSize={0.5}
        cellThickness={0.7}
        cellColor="#29313b"
        sectionSize={5}
        sectionThickness={1.2}
        sectionColor="#3e4a57"
        fadeDistance={24}
        fadeStrength={1}
        infiniteGrid
      />

      <OrbitControls
        makeDefault
        target={[0, 0.55, 0]}
        minDistance={2.5}
        maxDistance={14}
        maxPolarAngle={Math.PI * 0.49}
      />
    </Canvas>
  )
}
