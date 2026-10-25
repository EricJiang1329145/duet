import * as THREE from "three";

export function lambert(color, options = {}) {
  return new THREE.MeshLambertMaterial({
    color,
    flatShading: true,
    ...options
  });
}

export function addBox(
  parent,
  width,
  height,
  depth,
  color,
  x,
  y,
  z,
  options = {}
) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    lambert(color, options.materialOptions)
  );
  mesh.position.set(x, y, z);
  mesh.rotation.set(options.rx ?? 0, options.ry ?? 0, options.rz ?? 0);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
}

export function addCylinder(
  parent,
  radiusTop,
  radiusBottom,
  height,
  segments,
  color,
  x,
  y,
  z,
  options = {}
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    lambert(color, { ...options.materialOptions, flatShading: true })
  );
  mesh.position.set(x, y, z);
  mesh.rotation.set(options.rx ?? 0, options.ry ?? 0, options.rz ?? 0);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
}

export function addPlane(
  parent,
  width,
  height,
  color,
  x,
  y,
  z,
  options = {}
) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    lambert(color, {
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      ...options.materialOptions
    })
  );
  mesh.position.set(x, y, z);
  mesh.rotation.set(options.rx ?? -Math.PI / 2, options.ry ?? 0, options.rz ?? 0);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  parent.add(mesh);
  return mesh;
}

export function addGroup(parent, x = 0, y = 0, z = 0) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  parent.add(group);
  return group;
}
