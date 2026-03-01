---
title: HTML 3D Canvas (TypeScript)
description: How to create 3D canvas using HTML, CSS, TypeScript, Three.js, and Vite
---

# Three.js with Vite and TypeScript

This skill provides a standard way to implement 3D graphics using **Three.js**, **Vite**, and **TypeScript**.

## Setup and Installation

Install Three.js and its type definitions:

```bash
npm install three
npm install --save-dev @types/three
```

## Basic Boilerplate (TypeScript)

A basic Three.js setup requires a scene, a camera, and a renderer. In a Vite + TypeScript environment, we use proper types for better DX.

### Initialization Script

```typescript
import * as THREE from "three";

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
}

export const initScene = (container: HTMLElement): SceneContext => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  camera.position.z = 5;

  const animate = () => {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  };

  animate();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, camera, renderer };
};
```

## Vite Asset Handling

TypeScript requires type declarations for certain assets. Ensure your `env.d.ts` or `vite-env.d.ts` includes the necessary types, or import using Three.js loaders.

```typescript
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const loader = new GLTFLoader();
loader.load("/models/my-model.glb", (gltf) => {
  scene.add(gltf.scene);
});
```

## Performance Optimization

1. **Pixel Ratio**: Limit `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))`.
2. **Dispose**: Use `.dispose()` on geometries and materials to prevent memory leaks in SPAs.

## Animation Loop

Ensure you cancel `requestAnimationFrame` on component unmount (e.g., in `useEffect` cleanup for React).
