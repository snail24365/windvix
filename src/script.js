import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader";
import WindDataStore from "./WindDataStore";
import "./reset.css";
import blendFragmentShader from "./shaders/particle/blend_fragment.glsl";
import blendVertexShader from "./shaders/particle/blend_vertex.glsl";
import "./style.css";

import chroma from "chroma-js";
import { Mesh, PlaneGeometry, Scene, ShaderMaterial } from "three";
import { MapControls } from "./mapControls";
import { loadSeoulWeather } from "./service";

const WHITE = new THREE.Color(0xffffff);
const worldMapWidth = 2000;
const worldMapHeight = 857;

const resolutionRatio = 2;
let dataStore = null;

const windowSize = {
  width: window.innerWidth,
  height: window.innerHeight,
};

console.log(devicePixelRatio);

const canvas = document.querySelector("canvas.webgl");
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  logarithmicDepthBuffer: true,
  antialias: true,
  alpha: true,
});
renderer.setPixelRatio(1);

/********************
 * Draw Part
 ********************/
const cameraLength = 0.5;

const mainCamera = new THREE.OrthographicCamera(0, 2000, 800, 0, -10, 10);
const fullCamera = new THREE.OrthographicCamera(
  0,
  worldMapWidth,
  worldMapHeight,
  0,
  -10,
  10
);
fitCameraViewport();

const controls = new MapControls(mainCamera, canvas);
controls.enableRotate = false;
controls.minZoom = 1;
controls.maxZoom = 3;

controls.addEventListener("change", () => {
  const zoomRatio = (1 - 1 / mainCamera.zoom) / 2;
  const cameraWidth = mainCamera.right - mainCamera.left;
  const cameraHeight = mainCamera.top - mainCamera.bottom;

  const deltaX = zoomRatio * cameraWidth;
  const deltaY = zoomRatio * cameraHeight;

  controls.minPan.x = -deltaX;
  controls.maxPan.x = worldMapWidth + deltaX - cameraWidth;
  controls.maxPan.y = deltaY;
  controls.minPan.y = -worldMapHeight - deltaY + cameraHeight;
});

/********************
 * Update Part
 ********************/
const updateScene = new THREE.Scene();
const updateCamera = new THREE.OrthographicCamera(
  -0.5,
  0.5,
  0.5,
  -0.5,
  -10,
  10
);

const sqrtNumParticle = 250;

let positionBuffer = new THREE.WebGLRenderTarget(
  sqrtNumParticle,
  sqrtNumParticle,
  {
    magFilter: THREE.NearestFilter,
    minFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
  }
);
let positionOutputBuffer = new THREE.WebGLRenderTarget(
  sqrtNumParticle,
  sqrtNumParticle,
  {
    magFilter: THREE.NearestFilter,
    minFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
  }
);

const mainScene = new Scene();

window.addEventListener("resize", () => {
  windowSize.width = window.innerWidth;
  windowSize.height = window.innerHeight;
  controls.reset();
  fitCameraViewport();
});

(async () => {
  addWorldMapToScene();

  const velocityTexture = await getVelocityTexture();
  const particlePositionUpdateProgram = new THREE.Mesh(
    new PlaneGeometry(1, 1, sqrtNumParticle, sqrtNumParticle),
    new THREE.ShaderMaterial({
      vertexShader: `
      varying vec2 v_uv;

      void main() {
        v_uv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
      `,
      fragmentShader: `
      varying vec2 v_uv;
      uniform sampler2D velocityTexture;
      uniform sampler2D particlePositionTexture;
      uniform float deltaTime;
      uniform float time;
      uniform float worldMapWidth;
      uniform float worldMapHeight;
      uniform float timingSignal;

      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233)))* 43758.5453123);
      }
      
      float slowResetProbability(vec2 velocity) {
        float x = length(velocity);
        if (x < 0.1) {
          return 0.6;
        }
        if (x < 0.3) {
          return 0.2;
        }
        if (x < 5.) {
          return 0.05;
        }
        return 0.;
      }

      void main() {
        vec2 position = texture(particlePositionTexture, v_uv).xy;

        vec2 velocity = texture(velocityTexture, vec2(position.x / worldMapWidth, position.y / worldMapHeight)).xy;

        bool isInitPosition = position.x == 0.0 && position.y == 0.0;
        bool isRandomReset = random(v_uv + timingSignal * 0.1) < 0.15;
        bool isSlowReset = random(v_uv + timingSignal * 0.7 + 0.19) < slowResetProbability(velocity);
        // todo outside of viewport 
        bool isOutside = position.x <= 0.0 || position.x >= worldMapWidth || position.y <= 0.0 || position.y >= worldMapHeight;
        bool isNeedReset = isInitPosition || isRandomReset || isSlowReset || isOutside;
        
        position += velocity * deltaTime * 0.6;

        if(isNeedReset) {
          position.x = random(v_uv + 5.23 * sin(timingSignal + 1.7) + 1.23) * worldMapWidth;
          position.y = random(v_uv + 4.57 * sin(timingSignal + 3.4) + 3.45) * worldMapHeight;     
          gl_FragColor = vec4(position, 0.0, 0.0);
          return;
        }
        gl_FragColor = vec4(position, length(velocity), 1.0);
      }
    `,
      uniforms: {
        velocityTexture: { value: velocityTexture },
        particlePositionTexture: { value: positionBuffer.texture },
        worldMapWidth: { value: worldMapWidth },
        worldMapHeight: { value: worldMapHeight },
        time: { value: 0 },
        timingSignal: { value: 10 },
        deltaTime: { value: 0 },
      },
    })
  );

  updateScene.add(particlePositionUpdateProgram);

  const numColor = 1000;
  const paletteColors = chroma
    .scale(["#f00", "#0f0", "#00f"])
    .mode("lrgb")
    .colors(numColor)
    .flatMap((hexa) => {
      hexa = hexa.replace("#", "");
      const r = parseInt(hexa.substring(0, 2), 16) / 255;
      const g = parseInt(hexa.substring(2, 4), 16) / 255;
      const b = parseInt(hexa.substring(4, 6), 16) / 255;
      return [r, g, b, 1];
    });

  const paletteTexture = new THREE.DataTexture(
    new Float32Array(paletteColors),
    numColor,
    1,
    THREE.RGBAFormat,
    THREE.FloatType
  );
  paletteTexture.needsUpdate = true;

  const windFlow = new THREE.Points(
    new THREE.PlaneGeometry(1, 1, sqrtNumParticle, sqrtNumParticle),
    new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        velocityTexture: { value: velocityTexture },
        particlePositionTexture: { value: positionBuffer.texture },
        paletteTexture: { value: paletteTexture },
        timingSignal: { value: 0 },
      },
      vertexShader: `
          varying vec2 v_uv;
          varying vec2 v_pos;
          varying float v_speed;
          varying float v_isReseted;
          uniform sampler2D particlePositionTexture;

          void main() {
            v_uv = uv;
            gl_PointSize = 3.0;
            vec4 info = texture(particlePositionTexture, v_uv);
            vec2 pos = info.xy;
            v_speed = info.z;
            v_pos = pos.xy;
            v_isReseted = info.w;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 0.0001, 1.0);
          }`,
      fragmentShader: `
          varying vec2 v_uv;
          varying vec2 v_pos;
          varying float v_speed;
          varying float v_isReseted;

          uniform float timingSignal;

          uniform sampler2D paletteTexture;
          uniform sampler2D velocityTexture;
          uniform sampler2D particlePositionTexture;

          float random(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898,78.233)))* 43758.5453123);
          }

          void main() {
            if(v_isReseted == 0.0) { 
              gl_FragColor = vec4(0., 0., 0., 0.);  
            }
            // else if (v_speed < 2.0 && random(timingSignal * v_uv + timingSignal) < 0.9) {
            //   gl_FragColor = vec4(0., 0., 0., 0.);  
            // }
            else {
              gl_FragColor = texture2D(paletteTexture, vec2(v_speed / 20., 0.0));
            }
          }
        `,
    })
  );
  windFlow.frustumCulled = false;

  mainScene.add(windFlow);

  const screenScene = new Scene();
  const screenPlaneMesh = new Mesh(
    new PlaneGeometry(worldMapWidth, worldMapHeight),
    new ShaderMaterial({
      vertexShader: blendVertexShader,
      fragmentShader: blendFragmentShader,
      uniforms: {
        u_previous_screen: { value: null },
        u_previous_screen_alpha: { value: 0.8 },
      },
    })
  );
  screenPlaneMesh.position.set(worldMapWidth / 2, worldMapHeight / 2);
  screenScene.add(screenPlaneMesh);

  const clock = new THREE.Clock();

  let pastScreen = new THREE.WebGLRenderTarget(
    worldMapWidth * resolutionRatio,
    worldMapHeight * resolutionRatio
  );

  let currentScreen = new THREE.WebGLRenderTarget(
    worldMapWidth * resolutionRatio,
    worldMapHeight * resolutionRatio
  );

  let blendOutput = new THREE.WebGLRenderTarget(
    worldMapWidth * resolutionRatio,
    worldMapHeight * resolutionRatio
  );

  const blendScene = new Scene();
  const finalScene = new Scene();

  const finalScreen = new Mesh(
    new PlaneGeometry(worldMapWidth, worldMapHeight),
    new THREE.MeshBasicMaterial({ map: null })
  );
  finalScreen.position.set(worldMapWidth / 2, worldMapHeight / 2, 0);
  finalScene.add(finalScreen);

  const blendProgram = new Mesh(
    new PlaneGeometry(worldMapWidth, worldMapHeight),
    new ShaderMaterial({
      vertexShader: blendVertexShader,
      fragmentShader: blendFragmentShader,
      uniforms: {
        u_previous_screen: { value: null },
        u_current_screen: { value: null },
        u_previous_screen_alpha: { value: 0.9 },
      },
    })
  );
  blendProgram.position.set(worldMapWidth / 2, worldMapHeight / 2, 0);
  blendScene.add(blendProgram);

  const pastScene = new Scene();
  const pastScenePlane = new PlaneGeometry(worldMapWidth, worldMapHeight);
  const pastSceneMaterial = new ShaderMaterial({
    vertexShader: blendVertexShader,
    fragmentShader: blendFragmentShader,
    uniforms: {
      u_previous_screen: { value: null },
      u_previous_screen_alpha: { value: 0.9 },
    },
  });

  const pastSceneMesh = new Mesh(pastScenePlane, pastSceneMaterial);
  pastSceneMesh.position.set(worldMapWidth / 2, worldMapHeight / 2, 0);
  pastScene.add(pastSceneMesh);

  const viewPortScene = new Scene();
  const viewportPlane = new PlaneGeometry(worldMapWidth, worldMapHeight);
  const viewPortMaterial = new ShaderMaterial({
    vertexShader: blendVertexShader,
    fragmentShader: blendFragmentShader,
    uniforms: {
      u_previous_screen: { value: null },
      u_current_screen: { value: null },
      u_previous_screen_alpha: { value: 0.9 },
    },
  });
  const viewportPlaneMesh = new Mesh(viewportPlane, viewPortMaterial);
  viewportPlaneMesh.position.set(worldMapWidth / 2, worldMapHeight / 2, 0);
  viewPortScene.add(viewportPlaneMesh);
  renderer.autoClear = true;
  renderer.setClearColor(WHITE, 1.0);

  let prevTime = clock.getElapsedTime();
  const tick = () => {
    const now = clock.getElapsedTime();

    const deltaTime = now - prevTime;
    prevTime = now;
    const timingSignal = Math.floor(now * 4);

    particlePositionUpdateProgram.material.uniforms.time.value = now;
    particlePositionUpdateProgram.material.uniforms.particlePositionTexture.value =
      positionBuffer.texture;

    particlePositionUpdateProgram.material.uniforms.timingSignal.value =
      timingSignal;
    particlePositionUpdateProgram.material.uniforms.deltaTime.value = deltaTime;
    particlePositionUpdateProgram.material.needsUpdate = true;

    renderer.setRenderTarget(positionOutputBuffer);
    renderer.setSize(sqrtNumParticle, sqrtNumParticle, false);
    renderer.render(updateScene, updateCamera);
    windFlow.material.uniforms.particlePositionTexture.value =
      positionOutputBuffer.texture;
    windFlow.material.uniforms.timingSignal.value = timingSignal;

    // Blend
    renderer.setSize(worldMapWidth * 3, worldMapHeight * 3, false);
    renderer.setRenderTarget(currentScreen);
    renderer.render(mainScene, fullCamera);

    blendProgram.material.uniforms.u_current_screen.value =
      currentScreen.texture;
    blendProgram.material.uniforms.u_previous_screen.value = pastScreen.texture;
    renderer.setRenderTarget(blendOutput);
    renderer.render(blendScene, fullCamera);

    finalScreen.material.map = blendOutput.texture;
    renderer.setRenderTarget(null);
    renderer.setSize(windowSize.width, windowSize.height);
    renderer.render(finalScene, mainCamera);

    let tempScreenTarget = pastScreen;
    pastScreen = blendOutput;
    blendOutput = currentScreen;
    currentScreen = tempScreenTarget;

    if (isBlurOff) {
      renderer.setRenderTarget(pastScreen);
      renderer.setClearColor(WHITE, 1.0);
      renderer.clear();
    }

    let tempSwap = positionOutputBuffer;
    positionOutputBuffer = positionBuffer;
    positionBuffer = tempSwap;
  };

  renderer.setAnimationLoop(tick);
})();

loadSeoulWeather();

function addWorldMapToScene() {
  const loader = new SVGLoader();
  loader.load("world.svg", function (data) {
    const paths = data.paths;
    const worldMap = new THREE.Group();
    for (let i = 0; i < paths.length; i++) {
      const path = paths[i];
      const material = new THREE.MeshBasicMaterial({
        color: 0x9a9a9a,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const shapes = SVGLoader.createShapes(path);
      for (let j = 0; j < shapes.length; j++) {
        const shape = shapes[j];
        const geometry = new THREE.ShapeGeometry(shape);
        const countryOutline = new THREE.Mesh(geometry, material);
        worldMap.add(countryOutline);
      }
    }
    mainScene.add(worldMap);
  });
}

function calculateViewportSize() {
  const canvasRatio = window.innerWidth / window.innerHeight;
  const worldMapRatio = worldMapWidth / worldMapHeight;

  if (worldMapRatio > canvasRatio) {
    const width = worldMapHeight * canvasRatio;
    const height = worldMapHeight;
    return { width, height };
  } else {
    const width = worldMapWidth;
    const height = worldMapWidth / canvasRatio;
    return { width, height };
  }
}

function fitCameraViewport() {
  const { width, height } = calculateViewportSize();
  renderer.setSize(width, height, false);
  mainCamera.left = 0;
  mainCamera.right = width;
  mainCamera.top = worldMapHeight;
  mainCamera.bottom = worldMapHeight - height;
  mainCamera.updateProjectionMatrix();
}

async function getVelocityTexture() {
  dataStore = new WindDataStore();
  await dataStore.initialize();

  /* Position Update Part */
  const { header, lon, lat } = dataStore.data;
  const { nx: numLon, ny: numLat } = header;

  const encodedSpeed = new Float32Array(4 * numLon * numLat);
  for (let i = 0; i < numLon * numLat; i++) {
    const stride = i * 4;
    encodedSpeed[stride] = lon[i];
    encodedSpeed[stride + 1] = lat[i];
    encodedSpeed[stride + 3] = 255;
  }

  const velocityTexture = new THREE.DataTexture(
    encodedSpeed,
    numLon,
    numLat,
    THREE.RGBAFormat,
    THREE.FloatType
  );
  velocityTexture.needsUpdate = true;
  return velocityTexture;
}

const controlEventToleranceTime = 900; // miliseconds
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

const lonText = document.querySelector(".lon-value");
const latText = document.querySelector(".lat-value");
const xSpeedText = document.querySelector(".x-speed-value");
const ySpeedText = document.querySelector(".y-speed-value");

window.addEventListener("mousemove", (e) => {
  const xRatio = e.clientX / windowSize.width;
  const yRatio = 1 - e.clientY / windowSize.height;

  const lon = Number((xRatio * 360).toFixed(2));
  const lat = Number((yRatio * 180 - 90).toFixed(2));
  lonText.innerHTML = lon;
  latText.innerHTML = lat;

  if (dataStore) {
    const { lon: lons, lat: lats } = dataStore.data;
    const lonIndex = Math.floor(359 * xRatio);
    const latIndex = Math.floor(180 * yRatio);
    const index = 360 * latIndex + lonIndex;
    const lonWindVelocity = lons[index].toFixed(2);
    const latWindVelocity = lats[index].toFixed(2);
    xSpeedText.innerHTML = lonWindVelocity;
    ySpeedText.innerHTML = latWindVelocity;
  }
});
