"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const MODEL_SRC = "/models/sepang.glb";

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

      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const sun = new THREE.DirectionalLight(0xfff4e0, 1);
      sun.position.set(5, 8, 3);
      scene.add(sun);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.6;
      controls.maxPolarAngle = Math.PI * 0.49;

      const loader = new GLTFLoader();
      loader.load(
        MODEL_SRC,
        (gltf) => {
          if (cancelled) return;
          const root = gltf.scene;
          const box = new THREE.Box3().setFromObject(root);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const scale = 4 / Math.max(size.x, size.y, size.z, 0.001);
          root.scale.setScalar(scale);
          root.position.sub(center.multiplyScalar(scale));
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
    <section className="relative z-20 mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-paper-dim">
        Track model
      </p>
      <h2 className="mt-2 font-display text-3xl uppercase tracking-wide text-paper">
        Orbit Sepang
      </h2>
      <p className="mt-2 max-w-xl text-sm text-paper-dim">
        A 3D model of Sepang generated from the circuit&apos;s own apex +
        elevation data (<code className="text-amber">scripts/generate_circuit_models.py</code>),
        so the shape and its ~22&nbsp;m elevation change are real — vertical is
        exaggerated for readability. Drag to orbit.
      </p>

      <div
        ref={mountRef}
        className="relative mt-6 h-64 overflow-hidden rounded-lg border border-paper/10 bg-asphalt sm:h-80"
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
