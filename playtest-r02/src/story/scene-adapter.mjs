import {createScene as createR06Scene} from '/my-three-body-demo/playtest-r02/r06/src/scene-adapter.mjs';
export async function createScene(canvas,inputs){const scene=await createR06Scene(canvas,inputs);if(!scene.entities.includes('companion')||!scene.entities.includes('officer'))throw Error('ACTUAL_NPC_BINDINGS_REQUIRED');return scene;}
