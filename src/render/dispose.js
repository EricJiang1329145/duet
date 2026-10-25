/**
 * Release every geometry/material/texture under a Three object. Scene mounts
 * and dynamic crop rebuilds share this helper so resources never leak.
 */
export function disposeTreeResources(root) {
  if (!root) return;
  const geometries = new Set();
  const materials = new Set();

  root.traverse((object) => {
    if (!object.isMesh) return;

    if (object.geometry) geometries.add(object.geometry);

    const objectMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of objectMaterials) {
      if (material) materials.add(material);
    }
  });

  for (const geometry of geometries) {
    geometry.dispose();
  }

  for (const material of materials) {
    for (const value of Object.values(material)) {
      if (value && value.isTexture) value.dispose();
    }
    material.dispose();
  }
}

export function disposeChildren(object) {
  if (!object) return;
  for (const child of [...object.children]) {
    disposeTreeResources(child);
    object.remove(child);
  }
}
