import { Grid, OrbitControls, useGLTF } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

// Center of the spherical head shell, fitted from the Rhino-exported CAD.
// Both pan and tilt axes pass through this point.
const HEAD_SPHERE_CENTER = new THREE.Vector3(0, 0.09616257, 0)

// Pivots measured from the Rhino assemblies. Rhino Z becomes Three.js Y and
// Rhino Y becomes negative Three.js Z in the exported glTF files.
const PAN_OUTPUT_PIVOT = new THREE.Vector3(0, 0.04601, 0)
const PAN_DRIVE_PIVOT = new THREE.Vector3(0.0056, 0.032, 0)
const PAN_PINION_PIVOT = new THREE.Vector3(0.00461, 0.03199, -0.00016)
const TILT_PINION_PIVOT = new THREE.Vector3(-0.02897, 0.09616, 0)
const TILT_PINION_RATIO = 3

// The Rhino glass is a circular plate tilted 15 degrees from the YZ plane.
// These values are fitted directly from nova-glass.glb.
const SCREEN_CENTER = new THREE.Vector3(0.01275466, 0.09991729, 0)
const SCREEN_NORMAL = new THREE.Vector3(
  0.9659736,
  0.25864062,
  0,
).normalize()
const SCREEN_SURFACE = SCREEN_CENTER.clone().addScaledVector(SCREEN_NORMAL, 0.00125)
const SCREEN_RADIUS = 0.0408
const SCREEN_ROLL = THREE.MathUtils.degToRad(12)
const SCREEN_QUATERNION = new THREE.Quaternion().setFromUnitVectors(
  new THREE.Vector3(0, 0, 1),
  SCREEN_NORMAL,
)

function mergeRhinoScene(scene, material) {
  scene.updateMatrixWorld(true)
  const geometries = []

  scene.traverse((child) => {
    if (!child.isMesh) return

    const source = child.geometry.index
      ? child.geometry.toNonIndexed()
      : child.geometry.clone()

    source.applyMatrix4(child.matrixWorld)

    for (const attribute of Object.keys(source.attributes)) {
      if (attribute !== 'position' && attribute !== 'normal') {
        source.deleteAttribute(attribute)
      }
    }

    if (!source.getAttribute('normal')) {
      source.computeVertexNormals()
    }

    geometries.push(source)
  })

  const geometry = mergeGeometries(geometries, false)
  if (!geometry) {
    throw new Error('Could not merge Rhino geometry for Nova')
  }

  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()

  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function clonePart(scene, name, material) {
  const source = scene.getObjectByName(name)

  if (!source) {
    console.warn(`Nova internal part not found: ${name}`)
    return new THREE.Group()
  }

  const part = source.clone(true)
  part.traverse((child) => {
    if (!child.isMesh) return
    child.material = material
    child.castShadow = true
    child.receiveShadow = true
  })
  return part
}

function ScreenDisplay({ animation, run }) {
  const media = useMemo(() => {
    const video = document.createElement('video')
    video.src = `/animations/${animation}.mov`
    video.muted = true
    video.loop = true
    video.autoplay = true
    video.playsInline = true
    video.preload = 'auto'
    video.crossOrigin = 'anonymous'
    video.setAttribute('playsinline', '')
    video.setAttribute('webkit-playsinline', '')

    const texture = new THREE.VideoTexture(video)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.generateMipmaps = false

    return { video, texture }
  }, [animation, run])

  useEffect(() => {
    const { video, texture } = media

    const start = () => {
      video.currentTime = 0
      video.play().catch(() => {
        // Muted autoplay normally succeeds. If a browser blocks it, the next
        // user interaction with the controls will allow playback.
      })
    }

    video.addEventListener('canplay', start, { once: true })
    video.load()
    start()

    return () => {
      video.pause()
      video.removeEventListener('canplay', start)
      video.removeAttribute('src')
      video.load()
      texture.dispose()
    }
  }, [media])

  return (
    <group
      position={SCREEN_SURFACE.toArray()}
      quaternion={SCREEN_QUATERNION.toArray()}
      renderOrder={20}
    >
      <mesh rotation={[0, 0, SCREEN_ROLL]}>
        <circleGeometry args={[SCREEN_RADIUS, 96]} />
        <meshBasicMaterial
          map={media.texture}
          toneMapped={false}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

function NovaModel({ state, screenAnimation, screenAnimationRun, showInternals }) {
  const baseGltf = useGLTF('/models/nova-base.glb')
  const bodyGltf = useGLTF('/models/nova-body.glb')
  const headGltf = useGLTF('/models/nova-head.glb')
  const glassGltf = useGLTF('/models/nova-glass.glb')
  const internalsGltf = useGLTF('/models/nova-internals.glb')

  const materials = useMemo(
    () => ({
      body: new THREE.MeshPhysicalMaterial({
        color: '#f0f2f4',
        roughness: 0.28,
        metalness: 0.03,
        clearcoat: 0.28,
        clearcoatRoughness: 0.24,
      }),
      head: new THREE.MeshPhysicalMaterial({
        color: '#f4f5f7',
        roughness: 0.25,
        metalness: 0.02,
        clearcoat: 0.32,
        clearcoatRoughness: 0.22,
      }),
      internals: new THREE.MeshStandardMaterial({
        color: '#69727d',
        roughness: 0.42,
        metalness: 0.42,
      }),
      hardware: new THREE.MeshStandardMaterial({
        color: '#78838f',
        roughness: 0.34,
        metalness: 0.7,
      }),
      gears: new THREE.MeshStandardMaterial({
        color: '#d3a84a',
        roughness: 0.3,
        metalness: 0.78,
      }),
      motors: new THREE.MeshStandardMaterial({
        color: '#596471',
        roughness: 0.38,
        metalness: 0.62,
      }),
      supports: new THREE.MeshStandardMaterial({
        color: '#26313b',
        roughness: 0.46,
        metalness: 0.5,
      }),
      electronics: new THREE.MeshStandardMaterial({
        color: '#248568',
        roughness: 0.55,
        metalness: 0.18,
      }),
      speakers: new THREE.MeshStandardMaterial({
        color: '#161b22',
        roughness: 0.58,
        metalness: 0.38,
      }),
      glass: new THREE.MeshPhysicalMaterial({
        color: '#07090c',
        roughness: 0.09,
        metalness: 0.08,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
      }),
    }),
    [],
  )

  const base = useMemo(
    () => mergeRhinoScene(baseGltf.scene, materials.internals),
    [baseGltf.scene, materials.internals],
  )
  const body = useMemo(
    () => mergeRhinoScene(bodyGltf.scene, materials.body),
    [bodyGltf.scene, materials.body],
  )
  const head = useMemo(
    () => mergeRhinoScene(headGltf.scene, materials.head),
    [headGltf.scene, materials.head],
  )
  const glass = useMemo(
    () => mergeRhinoScene(glassGltf.scene, materials.glass),
    [glassGltf.scene, materials.glass],
  )

  const internalParts = useMemo(() => {
    const scene = internalsGltf.scene
    return {
      panMotor: clonePart(scene, 'pan_motor', materials.motors),
      tiltMotor: clonePart(scene, 'tilt_motor', materials.motors),
      driver: clonePart(scene, 'motor_driver_a4988', materials.electronics),
      baseSupports: clonePart(scene, 'base_supports', materials.supports),
      bearing: clonePart(scene, 'pan_bearing', materials.hardware),
      speakerPositive: clonePart(
        scene,
        'speaker_positive_y',
        materials.speakers,
      ),
      speakerNegative: clonePart(
        scene,
        'speaker_negative_y',
        materials.speakers,
      ),
      panOutput: clonePart(scene, 'pan_output_bevel_gear', materials.gears),
      panDrive: clonePart(scene, 'pan_drive_bevel_gear', materials.gears),
      panPinion: clonePart(scene, 'pan_motor_pinion', materials.gears),
      panHub: clonePart(scene, 'pan_shaft_hub', materials.hardware),
      tiltPinion: clonePart(scene, 'tilt_pinion_gear', materials.gears),
      tiltSegment: clonePart(scene, 'tilt_segment_gear', materials.gears),
    }
  }, [internalsGltf.scene, materials])

  useEffect(() => {
    const shellMaterials = [materials.body, materials.head, materials.internals]
    shellMaterials.forEach((material) => {
      material.transparent = showInternals
      material.opacity = showInternals ? 0.2 : 1
      material.depthWrite = !showInternals
      material.needsUpdate = true
    })

    materials.glass.transparent = showInternals
    materials.glass.opacity = showInternals ? 0.42 : 1
    materials.glass.depthWrite = !showInternals
    materials.glass.needsUpdate = true
  }, [materials, showInternals])

  const pan = useRef()
  const tilt = useRef()
  const panOutputGear = useRef()
  const panDriveGear = useRef()
  const panMotorPinion = useRef()
  const tiltPinionGear = useRef()

  useFrame((_, delta) => {
    const lambda = 18

    if (pan.current) {
      pan.current.rotation.y = THREE.MathUtils.damp(
        pan.current.rotation.y,
        state.joints.head_pan,
        lambda,
        delta,
      )
    }

    if (tilt.current) {
      tilt.current.rotation.z = THREE.MathUtils.damp(
        tilt.current.rotation.z,
        state.joints.head_tilt,
        lambda,
        delta,
      )
    }

    if (panOutputGear.current) {
      panOutputGear.current.rotation.y = THREE.MathUtils.damp(
        panOutputGear.current.rotation.y,
        state.joints.head_pan,
        lambda,
        delta,
      )
    }

    if (panDriveGear.current) {
      panDriveGear.current.rotation.x = THREE.MathUtils.damp(
        panDriveGear.current.rotation.x,
        -state.joints.head_pan,
        lambda,
        delta,
      )
    }

    if (panMotorPinion.current) {
      panMotorPinion.current.rotation.x = THREE.MathUtils.damp(
        panMotorPinion.current.rotation.x,
        -state.joints.head_pan,
        lambda,
        delta,
      )
    }

    if (tiltPinionGear.current) {
      tiltPinionGear.current.rotation.z = THREE.MathUtils.damp(
        tiltPinionGear.current.rotation.z,
        -state.joints.head_tilt * TILT_PINION_RATIO,
        lambda,
        delta,
      )
    }
  })

  return (
    <group>
      <primitive object={base} />
      <primitive object={body} />

      <group visible={showInternals}>
        <primitive object={internalParts.panMotor} />
        <primitive object={internalParts.driver} />
        <primitive object={internalParts.baseSupports} />
        <primitive object={internalParts.bearing} />
        <primitive object={internalParts.speakerPositive} />
        <primitive object={internalParts.speakerNegative} />

        <group ref={panOutputGear} position={PAN_OUTPUT_PIVOT.toArray()}>
          <group position={PAN_OUTPUT_PIVOT.clone().multiplyScalar(-1).toArray()}>
            <primitive object={internalParts.panOutput} />
            <primitive object={internalParts.panHub} />
          </group>
        </group>

        <group ref={panDriveGear} position={PAN_DRIVE_PIVOT.toArray()}>
          <group position={PAN_DRIVE_PIVOT.clone().multiplyScalar(-1).toArray()}>
            <primitive object={internalParts.panDrive} />
          </group>
        </group>

        <group ref={panMotorPinion} position={PAN_PINION_PIVOT.toArray()}>
          <group position={PAN_PINION_PIVOT.clone().multiplyScalar(-1).toArray()}>
            <primitive object={internalParts.panPinion} />
          </group>
        </group>
      </group>

      <group ref={pan} position={HEAD_SPHERE_CENTER.toArray()}>
        <group
          visible={showInternals}
          position={HEAD_SPHERE_CENTER.clone().multiplyScalar(-1).toArray()}
        >
          <primitive object={internalParts.tiltSegment} />
        </group>

        <group ref={tilt}>
          <group
            position={HEAD_SPHERE_CENTER.clone().multiplyScalar(-1).toArray()}
          >
            <primitive object={head} />
            <primitive object={glass} />
            <group visible={showInternals}>
              <primitive object={internalParts.tiltMotor} />

              <group ref={tiltPinionGear} position={TILT_PINION_PIVOT.toArray()}>
                <group position={TILT_PINION_PIVOT.clone().multiplyScalar(-1).toArray()}>
                  <primitive object={internalParts.tiltPinion} />
                </group>
              </group>
            </group>
            <ScreenDisplay
              animation={screenAnimation}
              run={screenAnimationRun}
            />
          </group>
        </group>
      </group>
    </group>
  )
}

function LoadingRobot() {
  return (
    <mesh position={[0, 0.07, 0]}>
      <sphereGeometry args={[0.045, 32, 24]} />
      <meshStandardMaterial color="#26313c" roughness={0.7} />
    </mesh>
  )
}

export default function RobotScene({
  state,
  screenAnimation = 'blinking',
  screenAnimationRun = 0,
  showInternals = true,
}) {
  return (
    <Canvas
      shadows
      camera={{
        position: [0.28, 0.18, 0.24],
        fov: 34,
        near: 0.005,
        far: 10,
      }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={['#090c11']} />
      <fog attach="fog" args={['#090c11', 0.55, 1.8]} />

      <hemisphereLight args={['#f4f7ff', '#11151b', 1.45]} />
      <directionalLight
        castShadow
        position={[0.24, 0.42, 0.30]}
        intensity={3.0}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.02}
        shadow-camera-far={1.2}
        shadow-camera-left={-0.18}
        shadow-camera-right={0.18}
        shadow-camera-top={0.22}
        shadow-camera-bottom={-0.04}
      />
      <directionalLight position={[-0.22, 0.20, -0.18]} intensity={0.85} />

      <Suspense fallback={<LoadingRobot />}>
        <NovaModel
          state={state}
          screenAnimation={screenAnimation}
          screenAnimationRun={screenAnimationRun}
          showInternals={showInternals}
        />
      </Suspense>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.0015, 0]} receiveShadow>
        <circleGeometry args={[0.42, 80]} />
        <meshStandardMaterial color="#0b0f14" roughness={1} />
      </mesh>

      <Grid
        args={[1, 1]}
        position={[0, -0.0005, 0]}
        cellSize={0.02}
        cellThickness={0.45}
        cellColor="#222a34"
        sectionSize={0.1}
        sectionThickness={0.85}
        sectionColor="#36414d"
        fadeDistance={0.9}
        fadeStrength={1.2}
        infiniteGrid
      />

      <OrbitControls
        makeDefault
        target={[0, 0.072, 0]}
        minDistance={0.17}
        maxDistance={1.2}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI * 0.49}
        enablePan={false}
      />
    </Canvas>
  )
}

useGLTF.preload('/models/nova-base.glb')
useGLTF.preload('/models/nova-body.glb')
useGLTF.preload('/models/nova-head.glb')
useGLTF.preload('/models/nova-glass.glb')
useGLTF.preload('/models/nova-internals.glb')
