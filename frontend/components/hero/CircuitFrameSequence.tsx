"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const FRAME_COUNT = 48;
const FRAME_PAD = 4;

function frameSrc(index: number) {
  const n = String(index + 1).padStart(FRAME_PAD, "0");
  return `/circuit-frames/${n}.webp`;
}

export function CircuitFrameSequence() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const geometry = new THREE.PlaneGeometry(2, 2);
    const loader = new THREE.TextureLoader();
    const textures: THREE.Texture[] = [];
    let hasFrames = false;

    const material = new THREE.MeshBasicMaterial({ color: 0x14181c });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const fallback = () => {
      material.color.set(0x0a0c0e);
      material.map = null;
      material.needsUpdate = true;
    };

    const applyTexture = (index: number) => {
      const texture = textures[index];
      if (!texture) return;
      material.map = texture;
      material.color.set(0xffffff);
      material.needsUpdate = true;
    };

    const loadFrames = async () => {
      const first = await new Promise<THREE.Texture | null>((resolve) => {
        loader.load(
          frameSrc(0),
          (texture) => resolve(texture),
          undefined,
          () => resolve(null)
        );
      });

      if (!first) {
        fallback();
        renderer.render(scene, camera);
        return;
      }

      hasFrames = true;
      first.minFilter = THREE.LinearFilter;
      first.magFilter = THREE.LinearFilter;
      textures[0] = first;
      applyTexture(0);
      renderer.render(scene, camera);

      for (let i = 1; i < FRAME_COUNT; i += 1) {
        loader.load(frameSrc(i), (texture) => {
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          textures[i] = texture;
        });
      }
    };

    const onScroll = () => {
      if (!hasFrames) return;
      const maxScroll = Math.max(document.body.scrollHeight - window.innerHeight, 1);
      const progress = Math.min(Math.max(window.scrollY / maxScroll, 0), 1);
      const index = Math.min(FRAME_COUNT - 1, Math.floor(progress * (FRAME_COUNT - 1)));
      if (textures[index]) applyTexture(index);
      renderer.render(scene, camera);
    };

    const onResize = () => {
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      renderer.render(scene, camera);
    };

    void loadFrames();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      geometry.dispose();
      material.dispose();
      textures.forEach((texture) => texture.dispose());
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="pointer-events-none absolute inset-0 z-0 opacity-90"
      aria-hidden
    />
  );
}
