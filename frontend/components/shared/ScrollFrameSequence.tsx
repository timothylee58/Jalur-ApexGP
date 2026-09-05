"use client";

import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";

interface ScrollFrameSequenceProps {
  /** Public directory holding zero-padded frames, e.g. "/circuit-frames". */
  framesPath: string;
  frameCount: number;
  /** Zero-pad width for frame filenames (0001.webp…). */
  framePad?: number;
  /** Solid color shown before the first frame loads. */
  loadingColor?: number;
  /** Solid color shown if frames never load (e.g. none extracted yet). */
  fallbackColor?: number;
  className?: string;
  /**
   * Ref to the ancestor spanning this section's whole sticky-pin range (the
   * sticky div plus its scroll-spacer sibling, both wrapped together).
   * Progress is measured against that element's own bounding rect instead
   * of the whole document — without it, two of these on one page (or one
   * page with other content below) share a single document-wide scroll
   * fraction, so a section starts mid-sequence or never reaches its last
   * frame by the time it unpins. Omit only for a page that is itself
   * exactly one full-page section with nothing else to scroll past.
   */
  rangeRef?: RefObject<HTMLElement | null>;
}

/**
 * Scroll-scrubbed WebP frame sequence rendered via three.js, mapped onto a
 * full-bleed plane. Generic and reusable — extracted from what was
 * originally CircuitFrameSequence's own implementation once a second scroll-
 * frame page (apple-design) needed the identical mechanism; that component
 * is now a thin wrapper around this one, unchanged in behavior.
 */
export function ScrollFrameSequence({
  framesPath,
  frameCount,
  framePad = 4,
  loadingColor = 0x14181c,
  fallbackColor = 0x0a0c0e,
  className = "pointer-events-none absolute inset-0 z-0 opacity-80",
  rangeRef,
}: ScrollFrameSequenceProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const frameSrc = (index: number) => {
      const n = String(index + 1).padStart(framePad, "0");
      return `${framesPath}/${n}.webp`;
    };

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

    const material = new THREE.MeshBasicMaterial({ color: loadingColor });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const fallback = () => {
      material.color.set(fallbackColor);
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
      // The loaded WebP frames are sRGB-encoded photos; three.js textures
      // default to NoColorSpace, which skips the sRGB decode and shifts
      // colors (most visible as a purple/magenta cast on dark tones) once
      // real frames are actually loaded — invisible before now because
      // every prior use of this component only ever hit the solid-color
      // fallback.
      first.colorSpace = THREE.SRGBColorSpace;
      textures[0] = first;
      applyTexture(0);
      renderer.render(scene, camera);

      for (let i = 1; i < frameCount; i += 1) {
        loader.load(frameSrc(i), (texture) => {
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.colorSpace = THREE.SRGBColorSpace;
          textures[i] = texture;
        });
      }
    };

    const onScroll = () => {
      if (!hasFrames) return;
      const rangeEl = rangeRef?.current;
      let progress: number;
      if (rangeEl) {
        const rect = rangeEl.getBoundingClientRect();
        const scrollable = Math.max(rect.height - window.innerHeight, 1);
        progress = Math.min(Math.max(-rect.top / scrollable, 0), 1);
      } else {
        const maxScroll = Math.max(document.body.scrollHeight - window.innerHeight, 1);
        progress = Math.min(Math.max(window.scrollY / maxScroll, 0), 1);
      }
      const index = Math.min(frameCount - 1, Math.floor(progress * (frameCount - 1)));
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
  }, [framesPath, frameCount, framePad, loadingColor, fallbackColor]);

  return <div ref={mountRef} className={className} aria-hidden />;
}
