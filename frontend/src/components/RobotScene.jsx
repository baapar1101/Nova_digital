import { Grid, OrbitControls, useGLTF } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

// Center of the spherical head shell, fitted from the Rhino-exported CAD.
// Both pan and tilt axes pass through this point.
const HEAD_SPHERE_CENTER = new THREE.Vector3(0, 0.09616257, 0)

// The Rhino glass is a circular plate tilted 15 degrees from the YZ plane.
// These values are fitted directly from nova-glass.glb.
const SCREEN_CENTER = new THREE.Vector3(0.01278194, 0.09985127, 0.00020264)
const SCREEN_NORMAL = new THREE.Vector3(
  0.965912353,
  0.258869325,
  0,
).normalize()
const SCREEN_SURFACE = SCREEN_CENTER.clone().addScaledVector(SCREEN_NORMAL, 0.00125)
const SCREEN_RADIUS = 0.0408

// A plane normal alone leaves one degree of freedom: roll around the normal.
// Build a full orthonormal basis so the face animation has a deterministic
// "up" direction matching the robot's vertical direction.
const SCREEN_WORLD_UP = new THREE.Vector3(0, 1, 0)
const SCREEN_Z = SCREEN_NORMAL.clone().normalize()
const SCREEN_X = new THREE.Vector3()
  .crossVectors(SCREEN_Z, SCREEN_WORLD_UP)
  .normalize()
const SCREEN_Y = new THREE.Vector3()
  .crossVectors(SCREEN_X, SCREEN_Z)
  .normalize()

const SCREEN_ROTATION_MATRIX = new THREE.Matrix4().makeBasis(
  SCREEN_X,
  SCREEN_Y,
  SCREEN_Z,
)

const SCREEN_QUATERNION = new THREE.Quaternion().setFromRotationMatrix(
  SCREEN_ROTATION_MATRIX,
)

// Fine calibration around the screen normal. Keep this at zero unless the
// physical screen needs a deliberate roll offset.
const SCREEN_ROLL = THREE.MathUtils.degToRad(0)
const SCREEN_ROLL_QUATERNION = new THREE.Quaternion().setFromAxisAngle(
  SCREEN_Z,
  SCREEN_ROLL,
)
SCREEN_QUATERNION.premultiply(SCREEN_ROLL_QUATERNION)

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

function ScreenDisplay({ animation }) {
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
  }, [animation])

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
    <mesh
      position={SCREEN_SURFACE.toArray()}
      quaternion={SCREEN_QUATERNION.toArray()}
      renderOrder={20}
    >
      <circleGeometry args={[SCREEN_RADIUS, 96]} />
      <meshBasicMaterial
        map={media.texture}
        toneMapped={false}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}

function NovaModel({ state, screenAnimation }) {
  const baseGltf = useGLTF('/models/nova-base.glb')
  const bodyGltf = useGLTF('/models/nova-body.glb')
  const headGltf = useGLTF('/models/nova-head.glb')
  const glassGltf = useGLTF('/models/nova-glass.glb')

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

  const pan = useRef()
  const tilt = useRef()

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
  })

  return (
    <group>
      <primitive object={base} />
      <primitive object={body} />

      <group ref={pan} position={HEAD_SPHERE_CENTER.toArray()}>
        <group ref={tilt}>
          <group
            position={HEAD_SPHERE_CENTER.clone().multiplyScalar(-1).toArray()}
          >
            <primitive object={head} />
            <primitive object={glass} />
            <ScreenDisplay animation={screenAnimation} />
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

export default function RobotScene({ state, screenAnimation = 'blinking' }) {
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
        <NovaModel state={state} screenAnimation={screenAnimation} />
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
