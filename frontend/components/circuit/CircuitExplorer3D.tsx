"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { circuitCorners } from "@/data/circuitCorners";
import { registerTerrain } from "@/lib/circuitTerrainAlign";
import { buildFlyoverCurve, FLYOVER_GRANDSTANDS, grandstandPosition } from "@/lib/circuitFlyoverTrack";

// Same real reference scan CircuitModelPreview.tsx uses for "Orbit Sepang"
// — see frontend/public/models/README.md for provenance/attribution and
// what was stripped from it. Loaded here as the real ground surface (curbs,
// grandstands, terrain, palms) under this component's own corner markers —
// registered against them by an actual similarity-transform search (see
// lib/circuitTerrainAlign.ts's registerTerrain), not a bounding-box
// auto-fit or a hand-tuned pose.
const TERRAIN_SRC = "/models/sepang.glb";
const DRACO_DECODER_PATH = "/draco/";

interface CircuitExplorer3DProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function CircuitExplorer3D({ selectedId, onSelect }: CircuitExplorer3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const hotspotMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0c0e);

    const camera = new THREE.PerspectiveCamera(
      42,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100,
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    // Lighting — soft ambient plus a single raking directional light so the
    // real terrain reads with some depth without needing shadow maps.
    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const sun = new THREE.DirectionalLight(0xfff4e0, 0.9);
    sun.position.set(4, 6, 2);
    scene.add(sun);

    // Ground — the fallback surface if the real terrain model (below)
    // fails to load; hidden once it loads successfully.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: 0x14181c, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    scene.add(ground);
    const grid = new THREE.GridHelper(20, 40, 0x2a3036, 0x1c2126);
    scene.add(grid);

    // Real apex-point centreline (data/sepang.json via
    // lib/circuitFlyoverTrack) — the same source CircuitFlyoverHero builds
    // its own curve from, rather than a separately traced-by-eye loop.
    // circuitCorners.ts's hotspot `t` values are calibrated against this
    // exact curve's point ordering. No visible line is drawn along it
    // (the real terrain below is the visual now); it exists purely as the
    // coordinate reference the corner markers, grandstands, start/finish
    // line, and terrain registration all place themselves against.
    const markerWidth = 0.05;
    const curve = buildFlyoverCurve();

    // Real terrain (see TERRAIN_SRC above) — loaded as the real ground
    // surface under the curve above, registered against it by an actual
    // similarity-transform search (lib/circuitTerrainAlign.ts's
    // registerTerrain — rotation, mirror, scale, and translation all
    // computed from the real geometry, not a hand-tuned pose). The curve
    // comes from this app's own real apex-point survey and this terrain
    // from an independent Sketchfab scan — two unrelated real-world
    // sources with no shared coordinate system, so this can align them
    // well but won't land every one of the 15 corners exactly on its real
    // counterpart; treat it as "the same track, correctly oriented and
    // scaled," not survey-grade fusion.
    const terrainDisposables: Array<{ dispose: () => void }> = [];
    const terrainDracoLoader = new DRACOLoader();
    terrainDracoLoader.setDecoderPath(DRACO_DECODER_PATH);
    const terrainLoader = new GLTFLoader();
    terrainLoader.setDRACOLoader(terrainDracoLoader);
    terrainLoader.load(
      TERRAIN_SRC,
      (gltf) => {
        const terrain = gltf.scene;

        terrain.traverse((child) => {
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
            terrainDisposables.push(child.geometry);
          }
        });

        // Everything below reads the terrain's own untransformed local
        // space — must happen before any scale/rotation/position is
        // applied to `terrain` itself.
        // "Ground level" here can't just be the bounding box's min.y — a
        // few objects in this scan (an embankment cross-section, mainly)
        // sit well below the actual track/grass surface, so that would
        // bury the real drivable surface deep beneath it. Each individual
        // object's own base *does* sit at its local ground contact point,
        // though, so the median of those bases approximates true ground
        // level while ignoring those few deep outliers.
        const objectBaseYs: number[] = [];
        terrain.traverse((child) => {
          if (child instanceof THREE.Mesh && !child.name.startsWith("Palm")) {
            objectBaseYs.push(new THREE.Box3().setFromObject(child).min.y);
          }
        });
        objectBaseYs.sort((a, b) => a - b);
        const groundY = objectBaseYs[Math.floor(objectBaseYs.length / 2)] ?? 0;

        const ribbonSamples = curve.getSpacedPoints(240).map((p) => ({ x: p.x, z: p.z }));

        const registrationStart = performance.now();
        const pose = registerTerrain(terrain, ribbonSamples, groundY);
        // Fit quality (and search cost) is inspectable rather than just
        // trusted — re-run and compare this if the terrain model or apex
        // data ever changes.
        console.debug(
          `[circuit] terrain registered: rotation=${((pose.rotationRad * 180) / Math.PI).toFixed(1)}°` +
            ` mirror=${pose.mirrorX} scale=${pose.scale.toFixed(3)}` +
            ` meanError=${pose.error.toFixed(4)}` +
            ` searchMs=${(performance.now() - registrationStart).toFixed(0)}`,
        );

        scene.add(terrain);
        ground.visible = false;
        grid.visible = false;
      },
      undefined,
      () => {
        // Real terrain missing — the flat fallback ground/grid above
        // stays visible.
      },
    );

    // Start/finish line marker.
    const startPoint = curve.getPointAt(0);
    const startTangent = curve.getTangentAt(0);
    const startLine = new THREE.Mesh(
      new THREE.BoxGeometry(markerWidth, 0.02, 0.05),
      new THREE.MeshBasicMaterial({ color: 0xf5a623 }),
    );
    startLine.position.copy(startPoint).setY(0.02);
    startLine.rotation.y = Math.atan2(startTangent.x, startTangent.z);
    scene.add(startLine);

    // Grandstand blocks — decorative, positioned as fractions along the
    // curve (same spec CircuitFlyoverHero uses) rather than hand-placed
    // world coordinates, so they stay sensible against this real geometry.
    const grandstandOffset = markerWidth * 1.4;
    FLYOVER_GRANDSTANDS.forEach((spec) => {
      const position = grandstandPosition(curve, spec, grandstandOffset);
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.1, 0.14),
        new THREE.MeshStandardMaterial({
          color: spec.color,
          emissive: spec.color,
          emissiveIntensity: 0.35,
          roughness: 0.6,
        }),
      );
      box.position.set(position.x, 0.05, position.z);
      scene.add(box);
    });

    // Corner hotspots — placed with getPoint (raw parameter), not getPointAt
    // (arc-length): circuitCorners.ts's `t` values are each corner's exact
    // index among the curve's real apex control points, so the un-remapped
    // parameter lands exactly on that point.
    const hotspotGroup = new THREE.Group();
    circuitCorners.forEach((corner) => {
      const point = curve.getPoint(corner.t);
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xf5a623 }),
      );
      dot.position.copy(point).setY(0.08);
      dot.userData.cornerId = corner.id;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.09, 0.12, 24),
        new THREE.MeshBasicMaterial({ color: 0xf5a623, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(point).setY(0.03);
      hotspotGroup.add(dot, ring);
      hotspotMeshesRef.current.set(corner.id, dot);
    });
    scene.add(hotspotGroup);

    // Camera framing — isometric-ish, orbiting around the centreline's
    // bounding box center rather than the world origin (the traced loop
    // isn't centered at 0,0). Built straight from the curve's own points
    // rather than a rendered mesh's geometry.
    const box = new THREE.Box3().setFromPoints(curve.getSpacedPoints(120));
    const center = box.getCenter(new THREE.Vector3());
    const radius = box.getSize(new THREE.Vector3()).length() * 0.62;

    let azimuth = Math.PI * 0.28;
    const elevation = 0.62;
    let autoRotate = true;
    let dragging = false;
    let lastX = 0;

    const applyCamera = () => {
      const x = center.x + radius * Math.cos(azimuth);
      const z = center.z + radius * Math.sin(azimuth);
      const y = radius * elevation;
      camera.position.set(x, y, z);
      camera.lookAt(center);
    };
    applyCamera();

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      autoRotate = false;
      lastX = event.clientX;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      azimuth += (event.clientX - lastX) * 0.005;
      lastX = event.clientX;
      applyCamera();
    };
    const onPointerUp = () => {
      dragging = false;
    };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const onClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(Array.from(hotspotMeshesRef.current.values()));
      if (hits.length > 0) {
        const id = hits[0].object.userData.cornerId as string;
        onSelectRef.current(id);
      }
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("click", onClick);

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (autoRotate) {
        azimuth += 0.0018;
        applyCamera();
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("click", onClick);
      window.removeEventListener("resize", onResize);
      ground.geometry.dispose();
      (ground.material as THREE.Material).dispose();
      terrainDisposables.forEach((item) => item.dispose());
      terrainDracoLoader.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  // Reflect the externally-selected corner (from clicking the list, not
  // just the canvas) onto the hotspot dots' scale/color.
  useEffect(() => {
    hotspotMeshesRef.current.forEach((mesh, id) => {
      const active = id === selectedId;
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.color.set(active ? 0xffffff : 0xf5a623);
      const scale = active ? 1.6 : 1;
      mesh.scale.setScalar(scale);
    });
  }, [selectedId]);

  return (
    <div
      ref={mountRef}
      className="h-[52vh] w-full cursor-grab overflow-hidden rounded-lg border border-paper/10 bg-asphalt active:cursor-grabbing sm:h-[60vh]"
      role="img"
      aria-label="Interactive 3D model of the Sepang International Circuit layout, built from the circuit's real apex-point centreline, with all 15 corner markers"
    />
  );
}
