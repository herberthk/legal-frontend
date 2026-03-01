# Example: Basic Scene (TypeScript)

This example shows how to use the boilerplate to create a simple rotating cube in a TypeScript environment.

```typescript
import { createThreeScene, ThreeSceneResult } from "../scripts/boilerplate.ts";
import * as THREE from "three";

const container = document.getElementById("app");
if (container) {
  const { scene, camera, renderer, cleanup }: ThreeSceneResult =
    createThreeScene(container);

  // Geometry
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
  const cube = new THREE.Mesh(geometry, material);
  scene.add(cube);

  // You can still access cube from outside or in a loop
  console.log("Scene initialized", scene);

  // Clean up if needed (e.g. on component unmount)
  // cleanup();
}
```

## How to use

1.  Install dependencies: `npm install three @types/three`
2.  Import `createThreeScene` from the boilerplate.
3.  Add your objects to the `scene`.
4.  Call `cleanup()` when the component unmounts to prevent memory leaks.
