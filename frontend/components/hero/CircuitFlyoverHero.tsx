"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  buildFlyoverCurve,
  buildFlyoverRibbon,
  FLYOVER_GRANDSTANDS,
  grandstandPosition,
} from "@/lib/circuitFlyoverTrack";

const CAR_SRC = "/models/car.glb";
// Seconds for one lap of the loop — arbitrary cinematic pacing for a
// continuously-looping background, not derived from any real lap time.
const LAP_SECONDS = 18;
// How long the one-time aerial-to-chase establishing shot takes after this
// scene mounts (i.e. right after the visitor toggles it on).
const INTRO_SECONDS = 3.5;

interface CircuitFlyoverHeroProps {
  className?: string;
}

/**
 * Opt-in 3D alternative to the landing hero's default static SVG map
 * (see LandingHero.tsx's toggle) — a continuously looping procedural
 * flyover, not video: an unbranded `car.glb` runs the real apex-point
 * centreline (lib/circuitFlyoverTrack, same source data as `sepang.glb`
 * and the 2D map) forever, camera easing from a high aerial establishing
 * shot into a low chase cam on mount. An original 3D asset per
 * docs/BRAND.md, not footage that needs rights clearing.
 */
export function CircuitFlyoverHero({
  className = "pointer-events-none absolute inset-0 z-0",
}: CircuitFlyoverHeroProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0c0e);
    // Fades the ribbon/grandstands into the background near the horizon —
    // cheap stand-in for atmosphere without needing an actual sky or ground
    // textures.
    scene.fog = new THREE.Fog(0x0a0c0e, 3.5, 9);

    const camera = new THREE.PerspectiveCamera(
      50,
      mount.clientWidth / Math.max(mount.clientHeight, 1),
      0.05,
      50,
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xfff0d8, 0.9);
    sun.position.set(4, 6, 2);
    scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ color: 0x101418, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    scene.add(ground);

    // Real apex-point centreline, same source as sepang.glb and the 2D map.
    const curve = buildFlyoverCurve();
    const ribbonWidth = 0.16;
    const { geometry: ribbonGeometry } = buildFlyoverRibbon(curve, ribbonWidth);
    const ribbonMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a4048,
      roughness: 0.85,
      side: THREE.DoubleSide,
    });
    const ribbon = new THREE.Mesh(ribbonGeometry, ribbonMaterial);
    scene.add(ribbon);

    const startPoint = curve.getPointAt(0);
    const startTangent = curve.getTangentAt(0);
    const startLineGeometry = new THREE.BoxGeometry(ribbonWidth, 0.02, 0.05);
    const startLineMaterial = new THREE.MeshBasicMaterial({ color: 0xf5a623 });
    const startLine = new THREE.Mesh(startLineGeometry, startLineMaterial);
    startLine.position.copy(startPoint).setY(0.02);
    startLine.rotation.y = Math.atan2(startTangent.x, startTangent.z);
    scene.add(startLine);

    const grandstandDisposables: Array<{ dispose: () => void }> = [];
    FLYOVER_GRANDSTANDS.forEach((spec) => {
      const geometry = new THREE.BoxGeometry(0.22, 0.1, 0.14);
      const material = new THREE.MeshStandardMaterial({
        color: spec.color,
        emissive: spec.color,
        emissiveIntensity: 0.35,
        roughness: 0.6,
      });
      grandstandDisposables.push(geometry, material);
      const box = new THREE.Mesh(geometry, material);
      const position = grandstandPosition(curve, spec, ribbonWidth * 2.2);
      box.position.set(position.x, 0.05, position.z);
      scene.add(box);
    });

    const center = new THREE.Box3().setFromObject(ribbon).getCenter(new THREE.Vector3());
    const aerialRadius =
      new THREE.Box3().setFromObject(ribbon).getSize(new THREE.Vector3()).length() * 0.72;

    // Animated car — same loader pattern as CircuitExplorer3D. Purely
    // decorative and loaded async; the scene degrades gracefully (car
    // just never appears) if the GLB is missing.
    let car: THREE.Object3D | null = null;
    const carDisposables: Array<{ dispose: () => void }> = [];
    new GLTFLoader().load(
      CAR_SRC,
      (gltf) => {
        car = gltf.scene;
        car.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            carDisposables.push(child.geometry);
            if (Array.isArray(child.material)) child.material.forEach((m) => carDisposables.push(m));
            else carDisposables.push(child.material);
          }
        });
        const carSize = new THREE.Box3().setFromObject(car).getSize(new THREE.Vector3());
        car.scale.setScalar((ribbonWidth * 3.2) / Math.max(carSize.x, carSize.z, 0.001));
        scene.add(car);
      },
      undefined,
      () => {
        car = null;
      },
    );

    const lookTarget = new THREE.Vector3();
    const aerialPos = new THREE.Vector3();
    const chasePos = new THREE.Vector3();

    const applyCamera = (elapsed: number) => {
      const carT = (elapsed % LAP_SECONDS) / LAP_SECONDS;
      const behindPoint = curve.getPointAt((carT - 0.05 + 1) % 1);
      const aheadPoint = curve.getPointAt((carT + 0.035) % 1);

      // 1 right after mount (wide establishing shot), eased to 0 by
      // INTRO_SECONDS in (settled into the low chase cam for good).
      const introT = Math.min(elapsed / INTRO_SECONDS, 1);
      const introBlend = 1 - introT * introT * (3 - 2 * introT); // smoothstep ease

      const bob = Math.sin(elapsed * 0.6) * 0.015;
      chasePos.copy(behindPoint).setY(0.5 + bob);

      // Angled 3/4 establishing view (same framing idea as CircuitExplorer3D's
      // default orbit) rather than a straight-down aerial — a top-down shot
      // of this small a loop against a plain ground plane reads as an empty
      // dark frame with a thin line in it. Slowly orbits for a bit of life.
      const az = 0.9 + elapsed * 0.03;
      aerialPos.set(
        center.x + aerialRadius * Math.cos(az),
        aerialRadius * 0.55,
        center.z + aerialRadius * Math.sin(az),
      );

      camera.position.lerpVectors(chasePos, aerialPos, introBlend);
      lookTarget.lerpVectors(aheadPoint, center, introBlend);
      lookTarget.y += (1 - introBlend) * 0.05; // look slightly up once chasing, not straight at the ground
      camera.lookAt(lookTarget);

      if (car) {
        car.position.copy(curve.getPointAt(carT)).setY(0.02);
        const tangent = curve.getTangentAt(carT);
        car.rotation.y = Math.atan2(tangent.x, tangent.z);
      }
    };

    const onResize = () => {
      camera.aspect = mount.clientWidth / Math.max(mount.clientHeight, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    const clock = new THREE.Clock();
    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      applyCamera(clock.getElapsedTime());
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onResize);
      ribbonGeometry.dispose();
      ribbonMaterial.dispose();
      ground.geometry.dispose();
      (ground.material as THREE.Material).dispose();
      startLineGeometry.dispose();
      startLineMaterial.dispose();
      grandstandDisposables.forEach((item) => item.dispose());
      carDisposables.forEach((item) => item.dispose());
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className={className} aria-hidden />;
}
