import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as dat from "lil-gui";
import WindDataManager from "./WindDataManager";
import updateVertexShader from "./shaders/particle/update_vertex.glsl";
import updateFragmentShader from "./shaders/particle/update_fragment.glsl";
import drawVertexShader from "./shaders/particle/draw_vertex.glsl";
import drawFragmentShader from "./shaders/particle/draw_fragment.glsl";
import blendVertexShader from "./shaders/particle/blend_vertex.glsl";
import blendFragmentShader from "./shaders/particle/blend_fragment.glsl";

import {
  BoxGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Uniform,
  Vector2,
} from "three";
import {
  makeFieldTexture,
  makeRandomPosition,
  transformToTextrue,
} from "./util";

const WHITE = new Color(0xffffff);

/* Common Global Variable */
// const gui = new dat.GUI({ width: 340 });
const debugObject = {};
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
};

const particleInfo = {
  _numParticle: 200000,

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
const particleScene = new THREE.Scene();
const aspectRatio = sizes.width / sizes.height;
const cameraSize = 0.5;
const viewPortCamera = new THREE.OrthographicCamera(
  (-cameraSize * sizes.width) / sizes.height,
  (cameraSize * sizes.width) / sizes.height,
  cameraSize,
  -cameraSize,
  -1,
  10
);

const particleCamera = new THREE.OrthographicCamera(
  (-cameraSize * sizes.width) / sizes.height,
  (cameraSize * sizes.width) / sizes.height,
  cameraSize,
  -cameraSize,
  -1,
  10
);

viewPortCamera.position.set(0, 0, 0.1);
viewPortCamera.lookAt(new THREE.Vector3(0, 0, 0));
particleScene.add(viewPortCamera);

const controls = new OrbitControls(viewPortCamera, canvas);
controls.enableDamping = true;
controls.enableRotate = false;

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

let positionBuffer = new THREE.WebGLRenderTarget(...positionBufferOption);
let pastPositionBuffer = new THREE.WebGLRenderTarget(...positionBufferOption);
let pastScreen = new THREE.WebGLRenderTarget(sizes.width, sizes.height);
let currentScreen = new THREE.WebGLRenderTarget(sizes.width, sizes.height);

function onResize(camera, render) {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  render.setSize(sizes.width, sizes.height);
  render.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

window.addEventListener("resize", () => onResize(viewPortCamera, renderer));

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
  particleScene.add(particles);

  renderer.setSize(particleInfo.gridLength, particleInfo.gridLength);
  renderer.setRenderTarget(positionBuffer);
  renderer.render(updateScene, updateCamera);

  particleMaterial.uniforms.particlePos.value = positionBuffer.texture;

  renderer.setRenderTarget(null);
  renderer.setSize(sizes.width, sizes.height);

  const pastScene = new Scene();
  const pastScenePlane = new PlaneGeometry((1 * sizes.width) / sizes.height, 1);
  const pastSceneMaterial = new ShaderMaterial({
    vertexShader: blendVertexShader,
    fragmentShader: blendFragmentShader,
    uniforms: {
      u_previous_screen: { type: "t", value: null },
      u_previous_screen_alpha: { value: 0.95 },
    },
  });
  pastScene.add(new Mesh(pastScenePlane, pastSceneMaterial));

  const viewPortScene = new Scene();
  const devicePlane = new PlaneGeometry((1 * sizes.width) / sizes.height, 1);
  const viewPortMaterial = new ShaderMaterial({
    vertexShader: blendVertexShader,
    fragmentShader: blendFragmentShader,
    uniforms: {
      u_previous_screen: { type: "t", value: null },
      u_previous_screen_alpha: { value: 1 },
    },
  });
  viewPortScene.add(new Mesh(devicePlane, viewPortMaterial));

  renderer.setSize(sizes.width, sizes.height);

  const clock = new THREE.Clock();
  let prevMoment = clock.getElapsedTime();

  const tick = () => {
    renderer.autoClear = false;
    const now = clock.getElapsedTime();
    const timeGap = now - prevMoment;
    prevMoment = now;

    // update position
    updateMaterial.uniforms.u_time.value = now;
    updateMaterial.uniforms.timeGap.value = timeGap;
    renderer.setSize(particleInfo.gridLength, particleInfo.gridLength);
    renderer.setRenderTarget(positionBuffer);
    renderer.render(updateScene, updateCamera);
    updateMaterial.uniforms.particlePos.value = positionBuffer.texture;

    // Current Scene 렌더 준비
    renderer.setSize(sizes.width, sizes.height);
    pastSceneMaterial.uniforms.u_previous_screen.value = pastScreen.texture;
    pastSceneMaterial.uniforms.u_previous_screen_alpha.value = 0.95;
    renderer.setRenderTarget(currentScreen);

    // 블러 Off 시 이전 Scene 초기화
    if (isBlurOff) {
      renderer.setRenderTarget(pastScreen);
      renderer.setClearColor(WHITE, 1.0);
      renderer.clear();
    }

    // 이전 Scene 렌더 후 현재 파티클 렌더
    renderer.render(pastScene, particleCamera);
    renderer.render(particleScene, particleCamera);

    // 화면으로 출력
    renderer.setRenderTarget(null);
    viewPortMaterial.uniforms.u_previous_screen.value = currentScreen.texture;
    renderer.render(viewPortScene, viewPortCamera);

    let tempSwap = pastPositionBuffer;
    pastPositionBuffer = positionBuffer;
    positionBuffer = tempSwap;

    tempSwap = pastScreen;
    pastScreen = currentScreen;
    currentScreen = tempSwap;
  };

  renderer.setAnimationLoop(tick);
})();

const controlEventToleranceTime = 1500; // miliseconds
let isBlurOff = false;
let isControlUpdated = false;
controls.addEventListener("change", (e, t) => {
  isControlUpdated = true;
  isBlurOff = true;
  setTimeout(() => {
    if (isControlUpdated) {
      isBlurOff = false;
      isControlUpdated = false;
    }
  }, controlEventToleranceTime);
});
