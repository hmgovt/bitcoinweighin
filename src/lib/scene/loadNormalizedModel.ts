/**
 * Load a .glb and uniformly scale it so its bounding-box size along `axis`
 * equals `targetSizeM`, then sit it on the ground (min.y === 0). Every
 * reference/prop model in the scene (Shiba, dollar bill) uses this so a
 * model's real-world size comes from one measured constant here, never a
 * guess baked into the asset's own export scale — the Shiba's glb and the
 * bill's glb both ship at whatever scale their source tool exported them
 * at (the bill happens to be exactly 2x true size, a Sketchfab artifact);
 * this function is what makes that not matter.
 */
import type * as THREE from 'three';
import type { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function loadNormalizedModel(
	three: typeof THREE,
	GLTFLoaderCtor: typeof GLTFLoader,
	meshoptDecoder: Parameters<GLTFLoader['setMeshoptDecoder']>[0],
	url: string,
	targetSizeM: number,
	axis: 'x' | 'y' | 'z',
	onLoad: (object: THREE.Object3D, animations: THREE.AnimationClip[]) => void,
	onError?: () => void
): void {
	const loader = new GLTFLoaderCtor();
	loader.setMeshoptDecoder(meshoptDecoder);
	loader.load(
		url,
		(gltf) => {
			const object = gltf.scene;
			const box = new three.Box3().setFromObject(object);
			const size = box.getSize(new three.Vector3());
			const rawSize = axis === 'x' ? size.x : axis === 'y' ? size.y : size.z;
			if (rawSize > 0) object.scale.setScalar(targetSizeM / rawSize);
			const groundedBox = new three.Box3().setFromObject(object);
			object.position.y -= groundedBox.min.y;
			onLoad(object, gltf.animations ?? []);
		},
		undefined,
		() => onError?.()
	);
}
