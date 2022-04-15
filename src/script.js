import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as dat from "lil-gui";
import WindDataManager from "./WindDataManager";
import updateVertexShader from "./shaders/particle/update_vertex.glsl";
import updateFragmentShader from "./shaders/particle/update_fragment.glsl";
import drawVertexShader from "./shaders/particle/draw_vertex.glsl";
import drawFragmentShader from "./shaders/particle/draw_fragment.glsl";

import {
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Uniform,
  Vector2,
} from "three";
import {
  makeFieldTexture,
  makeRandomPosition,
  transformToTextrue,
} from "./util";

/* Common Global Variable */
// const gui = new dat.GUI({ width: 340 });
const debugObject = {};
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

const particleInfo = {
  _numParticle: 300000,

  get gridLength() {
    return parseInt(Math.sqrt(this._numParticle));
  },

  get numParticle() {
    return this._numParticle;
  },

  set numParticle(numParticle) {
    this._numParticle = numParticle;
  },
};

const canvas = document.querySelector("canvas.webgl");
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

/********************
 * Draw Part
 ********************/
const drawScene = new THREE.Scene();
const aspectRatio = sizes.width / sizes.height;
const drawCamera = new THREE.PerspectiveCamera(75, aspectRatio, 0.0001, 100);
drawCamera.position.set(0, 0, 0.7);
drawCamera.lookAt(new THREE.Vector3(0, 0, 0));
drawScene.add(drawCamera);

const controls = new OrbitControls(drawCamera, canvas);
controls.enableDamping = true;

/********************
 * Update Part
 ********************/
const updateScene = new THREE.Scene();
const updateCamera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, -1, 10);
updateCamera.position.set(0, 0, 1);
updateCamera.lookAt(new THREE.Vector3(0, 0, 0));
updateScene.add(updateCamera);

const positionBufferOption = [
  particleInfo.gridLength,
  particleInfo.gridLength,
  {
    magFilter: THREE.NearestFilter,
    minFilter: THREE.NearestFilter,
  },
];

const blendBufferOption = [sizes.width, sizes.height];

let positionFrameBuffer1 = new THREE.WebGLRenderTarget(...positionBufferOption);
let positionFrameBuffer2 = new THREE.WebGLRenderTarget(...positionBufferOption);
let blendFrameBuffer = new THREE.WebGLRenderTarget(...blendBufferOption);

function onResize(camera, render) {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  render.setSize(sizes.width, sizes.height);
  render.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

window.addEventListener("resize", () => onResize(drawCamera, renderer));

(async () => {
  const windDataManager = new WindDataManager();
  await windDataManager.init();

  /* Position Update Part */
  const gridLength = particleInfo.gridLength;

  const updateGeometry = new THREE.BufferGeometry();
  const planeGeometry = new PlaneGeometry(1, 1, gridLength - 1, gridLength - 1);
  updateGeometry.setAttribute("position", planeGeometry.attributes.position);
  updateGeometry.setAttribute("uv", planeGeometry.attributes.uv);
  updateGeometry.index = planeGeometry.index;

  /* Position Update Part - uniform */
  const position = makeRandomPosition(gridLength, gridLength);
  const positionTexture = transformToTextrue(position, gridLength, gridLength);

  const { vxMax, vxMin, vyMax, vyMin, maxSpeed } = windDataManager.meta;
  const windVelocityTexture = makeFieldTexture(windDataManager);

  console.log(windDataManager.meta);

  const windResolution = new Uniform(
    new Vector2(windDataManager.meta.numX, windDataManager.meta.numY)
  );

  const updateMaterial = new THREE.ShaderMaterial({
    vertexShader: updateVertexShader,
    fragmentShader: updateFragmentShader,
    uniforms: {
      aspectRatio: { value: sizes.height / sizes.width }, // TODO: 변하면 변경해줘야함
      particlePos: { type: "t", value: positionTexture },
      windVelocity: { type: "t", value: windVelocityTexture },
      timeGap: { value: 0 },
      windResolution: windResolution,
      randomSeed: { value: Math.random() },
      maxSpeed: { value: maxSpeed },
      vxMax: { value: vxMax },
      vxMin: { value: vxMin },
      vyMax: { value: vyMax },
      vyMin: { value: vyMin },
      u_speed_scale: { value: 0.0005 },
      u_drop_rate: { value: 0.1 },
      u_drop_rate_bump: { value: 0.005 },
      u_time: { value: 0 },
    },
  });

  /* Particle Draw Part */
  const particleMaterial = new THREE.ShaderMaterial({
    vertexShader: drawVertexShader,
    fragmentShader: drawFragmentShader,
    uniforms: {
      aspectRatio: { value: sizes.height / sizes.width }, // TODO: 변하면 변경해줘야함
      particlePos: { type: "t", value: positionTexture },
      windVelocity: { type: "t", value: windVelocityTexture },
      maxSpeed: { value: maxSpeed },
      vxMax: { value: vxMax },
      vxMin: { value: vxMin },
      vyMax: { value: vyMax },
      vyMin: { value: vyMin },
    },
  });

  const particleGeometry = new THREE.BufferGeometry();
  const planePrototype = new PlaneGeometry(
    1,
    1,
    gridLength - 1,
    gridLength - 1
  );
  particleGeometry.setAttribute("position", planePrototype.attributes.position);
  particleGeometry.setAttribute("uv", planePrototype.attributes.uv);

  const updateMesh = new THREE.Mesh(updateGeometry, updateMaterial);
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  updateScene.add(updateMesh);
  drawScene.add(particles);

  renderer.setSize(particleInfo.gridLength, particleInfo.gridLength);
  renderer.setRenderTarget(positionFrameBuffer1);
  renderer.render(updateScene, updateCamera);

  // renderer.setRenderTarget(null);
  // renderer.setSize(sizes.width, sizes.height);
  particleMaterial.uniforms.particlePos.value = positionFrameBuffer1.texture;

  renderer.setRenderTarget(null);
  renderer.setSize(sizes.width, sizes.height);

  const finalResultScene = new Scene();
  const blendPlane = new PlaneGeometry(2, 1);
  finalResultScene.add(
    new Mesh(blendPlane, new MeshBasicMaterial({ color: 0xffffff }))
  );

  const clock = new THREE.Clock();
  let prevMoment = clock.getElapsedTime();

  const tick = () => {
    const now = clock.getElapsedTime();
    const timeGap = now - prevMoment;
    prevMoment = now;

    console.log(Math.floor(now * 0.9));

    updateMaterial.uniforms.u_time.value = now;
    updateMaterial.uniforms.timeGap.value = timeGap;
    renderer.setSize(particleInfo.gridLength, particleInfo.gridLength);
    renderer.setRenderTarget(positionFrameBuffer1);
    renderer.render(updateScene, updateCamera);

    // 과거 화면에 덫 입힘 블렌딩 알파 적용해서
    renderer.setRenderTarget(null); // 이거 blendBuffer? 로 아마 수정해야할듯
    renderer.setSize(sizes.width, sizes.height);
    particleMaterial.uniforms.particlePos.value = positionFrameBuffer1.texture;
    renderer.render(drawScene, drawCamera);
    // 블렌드 버퍼를 그 final geometry에 적용.

    // 과거화면 그려줌.
    // renderer.setRenderTarget(blendFrameBuffer);
    // renderer.render(drawScene, drawCamera);

    const tempSwap = positionFrameBuffer2;
    positionFrameBuffer2 = positionFrameBuffer1;
    positionFrameBuffer1 = tempSwap;

    updateMaterial.uniforms.particlePos.value = positionFrameBuffer2.texture;
    controls.update();
  };

  renderer.setAnimationLoop(tick);
})();
