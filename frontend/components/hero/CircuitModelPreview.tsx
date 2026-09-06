"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const MODEL_SRC = "/models/sepang.glb";
// sepang.glb (scripts/blender/build_sepang_from_reference_scan.py) is
// exported with Draco mesh compression to hit this app's size budget on
// the real reference scan — GLTFLoader can't decode that without a
// DRACOLoader wired in. Decoder files are self-hosted (copied from
// three's own package, not fetched from Google's CDN) at /public/draco/,
// matching this app's convention of not depending on third-party CDNs
// for core assets — see /models/README.md.
const DRACO_DECODER_PATH = "/draco/";

// Initial camera framing mirrors a real establishing shot of the pit
// straight / main grandstand, from this Google Earth reference view:
// https://earth.google.com/web/@2.75990886,101.73779433,36.25740786a,1930.44055644d,35y,48.48808706h,60t,0r
// (heading 48.49°, tilt 60° from nadir — i.e. 30° of elevation above the
// horizon; that target point sits ~104 m from this model's own
// Start/Finish apex, per data/sepangCircuit.ts). The model's own axes
// (scripts/generate_circuit_models.py's lat/lon projection) put +X = east
// and -Z = north, so a camera *facing* that heading sits on the opposite
// bearing (heading + 180°) from the target it's looking at; the tilt's
// elevation angle sets the height-to-horizontal-distance ratio. Overall
// distance is picked to roughly match the old hardcoded framing's zoom
// level, not the real 1930 m the reference shot was taken from.
const CAMERA_HEADING_DEG = 48.48808706;
const CAMERA_ELEVATION_DEG = 90 - 60; // tilt is measured from nadir, not the horizon
const CAMERA_DISTANCE = 7.8;

function initialCameraPosition(): THREE.Vector3 {
  const heading = (CAMERA_HEADING_DEG * Math.PI) / 180;
  const elevation = (CAMERA_ELEVATION_DEG * Math.PI) / 180;
  const horizontal = CAMERA_DISTANCE * Math.cos(elevation);
  const height = CAMERA_DISTANCE * Math.sin(elevation);
  return new THREE.Vector3(-horizontal * Math.sin(heading), height, horizontal * Math.cos(heading));
}

export function CircuitModelPreview() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    async function boot() {
      try {
        const head = await fetch(MODEL_SRC, { method: "HEAD" });
        if (!head.ok) {
          if (!cancelled) setStatus("missing");
          return;
        }
      } catch {
        if (!cancelled) setStatus("missing");
        return;
      }

      const mount = mountRef.current;
      if (!mount || cancelled) return;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0a0c0e);

      const camera = new THREE.PerspectiveCamera(
        40,
        mount.clientWidth / Math.max(mount.clientHeight, 1),
        0.1,
        200
      );
      camera.position.copy(initialCameraPosition());

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      mount.appendChild(renderer.domElement);

      // PCFSoftShadowMap + a ground-catcher plane below the model (added
      // once the model's real extent is known, in the loader callback)
      // give the ribbon a soft contact shadow — the cheapest way to read
      // "this is a solid object sitting on a surface" rather than a shape
      // floating in a void.
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const sun = new THREE.DirectionalLight(0xfff4e0, 1.4);
      sun.position.set(5, 8, 3);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 20;
      sun.shadow.camera.left = -5;
      sun.shadow.camera.right = 5;
      sun.shadow.camera.top = 5;
      sun.shadow.camera.bottom = -5;
      scene.add(sun);

      const ground = new THREE.Mesh(
        new THREE.CircleGeometry(6, 64),
        new THREE.ShadowMaterial({ opacity: 0.45 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      ground.visible = false; // repositioned under the model once it loads
      scene.add(ground);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.6;
      controls.maxPolarAngle = Math.PI * 0.49;

      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath(DRACO_DECODER_PATH);
      const loader = new GLTFLoader();
      loader.setDRACOLoader(dracoLoader);
      loader.load(
        MODEL_SRC,
        (gltf) => {
          if (cancelled) return;
          const root = gltf.scene;
          const box = new THREE.Box3().setFromObject(root);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const scale = 4 / Math.max(size.x, size.y, size.z, 0.001);
          const lowestY = (box.min.y - center.y) * scale;
          root.scale.setScalar(scale);
          root.position.sub(center.multiplyScalar(scale));

          // The real scan's footprint is a wide landscape rectangle, not
          // the old ribbon model's roughly-square bounds the hardcoded
          // radius-6 shadow catcher was sized for — an oversized catcher
          // here casts a visible shadow patch well past the mesh's own
          // edges. Re-size it to the loaded model's actual (scaled)
          // footprint instead of guessing a constant.
          const footprintRadius =
            0.5 * Math.hypot(size.x * scale, size.z * scale) * 1.15;
          ground.geometry.dispose();
          ground.geometry = new THREE.CircleGeometry(footprintRadius, 64);

          // three.js's GLTFLoader falls back to metalness:1/roughness:1 for
          // any mesh whose glTF has no material at all (a real past bug
          // here — see git history — for the old trimesh-exported
          // vertex-color-only ribbon, which never attached a material).
          // The current model (scripts/blender/build_sepang_from_reference_scan.py)
          // has real Blender-exported materials with real baseColor
          // textures and metalness:0, so this only needs to step in for a
          // mesh that genuinely has none — never overwrite a real texture.
          root.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              const material = child.material as THREE.MeshStandardMaterial | undefined;
              if (!material?.map) {
                child.material = new THREE.MeshStandardMaterial({
                  vertexColors: true,
                  roughness: 0.65,
                  metalness: 0.05,
                  side: THREE.DoubleSide,
                });
              }
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          ground.position.y = lowestY - 0.02;
          ground.visible = true;
          scene.add(root);
          setStatus("ready");
        },
        undefined,
        () => {
          if (!cancelled) setStatus("missing");
        }
      );

      let frame = 0;
      const tick = () => {
        frame = requestAnimationFrame(tick);
        controls.update();
        renderer.render(scene, camera);
      };
      tick();

      const onResize = () => {
        if (!mount) return;
        camera.aspect = mount.clientWidth / Math.max(mount.clientHeight, 1);
        camera.updateProjectionMatrix();
        renderer.setSize(mount.clientWidth, mount.clientHeight);
      };
      window.addEventListener("resize", onResize);

      cleanup = () => {
        cancelAnimationFrame(frame);
        window.removeEventListener("resize", onResize);
        controls.dispose();
        renderer.dispose();
        dracoLoader.dispose(); // tears down its decoder worker pool
        if (mount.contains(renderer.domElement)) {
          mount.removeChild(renderer.domElement);
        }
      };
    }

    void boot();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return (
    <section
      id="orbit-sepang"
      className="relative z-20 mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14 md:py-16"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-paper-dim">
        Track model
      </p>
      <h2 className="mt-2 font-display text-[clamp(1.75rem,5vw,2.5rem)] uppercase tracking-wide text-paper">
        Orbit Sepang
      </h2>
      <p className="mt-2 max-w-xl text-sm text-paper-dim">
        A real photogrammetry scan of Sepang — track surface, curbs,
        grandstands, and elevation as-built, not a traced-by-eye or
        procedural approximation. Sourced under CC BY 4.0; see{" "}
        <code className="text-amber">frontend/public/models/README.md</code>{" "}
        for the full attribution and pipeline. Drag to orbit.
      </p>

      <div
        ref={mountRef}
        className="relative mt-6 aspect-[16/10] min-h-56 w-full overflow-hidden rounded-lg border border-paper/10 bg-asphalt sm:min-h-72 md:min-h-80"
      >
        {status === "missing" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="font-mono text-xs uppercase tracking-wide text-paper-dim">
              No GLB yet
            </p>
            <Link
              href="/circuit"
              className="rounded-full border border-amber/40 px-4 py-2 font-mono text-[11px] uppercase tracking-wide text-amber hover:bg-amber/10"
            >
              Open corner-by-corner 3D
            </Link>
          </div>
        ) : null}
        {status === "loading" ? (
          <p className="absolute inset-0 flex items-center justify-center font-mono text-xs text-paper-dim">
            Checking for model…
          </p>
        ) : null}
      </div>
    </section>
  );
}
