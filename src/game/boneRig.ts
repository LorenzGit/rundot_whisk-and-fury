import { MeshPlane, type Texture } from "pixi.js";

/**
 * A tiny four-joint, CPU-skinned rig for illustrated character sheets.
 * The heel joint has a hard zero weight, while hip/chest/head influence is
 * blended up the mesh. This keeps the character planted without requiring a
 * Spine runtime or separate limb artwork.
 */
export interface BoneRig {
    view: MeshPlane;
    setTexture(texture: Texture): void;
    breathe(time: number, strength?: number): void;
    reset(): void;
}

const VERTICES_X = 5;
const VERTICES_Y = 9;

function smoothstep(edge0: number, edge1: number, value: number): number {
    const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

export function createBoneRig(initialTexture: Texture, phase = 0): BoneRig {
    const view = new MeshPlane({ texture: initialTexture, verticesX: VERTICES_X, verticesY: VERTICES_Y });
    let basePositions = new Float32Array();
    let positionBuffer = view.geometry.getAttribute("aPosition").buffer;

    const captureBindPose = () => {
        positionBuffer = view.geometry.getAttribute("aPosition").buffer;
        basePositions = Float32Array.from(positionBuffer.data);
        view.pivot.set(view.texture.width / 2, view.texture.height);
    };

    const reset = () => {
        positionBuffer.data.set(basePositions);
        positionBuffer.update();
    };

    captureBindPose();

    return {
        view,
        setTexture(texture) {
            reset();
            view.texture = texture;
            captureBindPose();
        },
        breathe(time, strength = 1) {
            const width = view.texture.width;
            const height = view.texture.height;
            const breath = Math.sin(time * 1.75 + phase) * strength;
            const counterSway = Math.sin(time * 0.82 + phase * 0.7) * strength;

            for (let index = 0; index < basePositions.length; index += 2) {
                const bindX = basePositions[index]!;
                const bindY = basePositions[index + 1]!;
                const up = 1 - bindY / height;

                // Four virtual joints: heel (locked), hip, chest, head.
                const hipWeight = smoothstep(0.08, 0.42, up);
                const chestWeight = smoothstep(0.3, 0.72, up);
                const headWeight = smoothstep(0.68, 0.96, up);
                const chestExpansion = chestWeight * (1 - headWeight * 0.82);
                const centeredX = bindX - width / 2;

                positionBuffer.data[index] =
                    bindX +
                    counterSway * (1.5 * hipWeight + 4.5 * chestWeight + 1.5 * headWeight) +
                    centeredX * breath * 0.0028 * chestExpansion;
                positionBuffer.data[index + 1] =
                    bindY - breath * (0.6 * hipWeight + 3.8 * chestWeight + 1.8 * headWeight);
            }
            positionBuffer.update();
        },
        reset,
    };
}
