import * as THREE from "three";

var seed = 1;
function random() {
  var x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

export function generatelinearTransformation(maxV, minV, maxW, minW) {
  return (value) => minW + (maxW - minW) * ((value - minV) / (maxV - minV));
}

export function splitColor2d(color2d) {
  let upperPart = parseInt(color2d / 256);
  let lowerPart = parseInt(((color2d / 256) % 1) * 256);
  return [upperPart, lowerPart];
}

export function makeFieldTexture(windDataManager) {
  const vx = windDataManager.vx;
  const vy = windDataManager.vy;

  const { numX, numY, vxMax, vxMin, vyMax, vyMin } = windDataManager.meta;

  const size = numX * numY;
  if (vx.length !== size) {
    throw "데이터 차원이 맞지 않습니다.";
  }

  const data = new Uint8Array(4 * size);

  const color2dMax = 256 * 256 - 1;
  const xToColor2d = generatelinearTransformation(vxMax, vxMin, color2dMax, 0);
  const yToColor2d = generatelinearTransformation(vyMax, vyMin, color2dMax, 0);

  for (let i = 0; i < size; i++) {
    const stride = i * 4;
    const xColor2d = xToColor2d(vx[i]);
    const yColor2d = yToColor2d(vy[i]);

    const [r, g] = splitColor2d(xColor2d);
    const [b, a] = splitColor2d(yColor2d);

    data[stride] = r;
    data[stride + 1] = g;
    data[stride + 2] = b;
    data[stride + 3] = a;
  }
  const texture = new THREE.DataTexture(
    data,
    numX,
    numY,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
    THREE.Texture.DEFAULT_MAPPING,
    THREE.ClampToEdgeWrapping,
    THREE.ClampToEdgeWrapping
  );
  texture.needsUpdate = true;
  return texture;
}

export function makeRandomPosition(width, height) {
  const size = width * height;
  const position = new Uint8Array(4 * size);

  for (let i = 0; i < size; i++) {
    const stride = i * 4;
    position[stride] = Math.floor(random() * 255) + 1;
    position[stride + 1] = Math.floor(random() * 255) + 1;
    position[stride + 2] = Math.floor(random() * 255) + 1;
    position[stride + 3] = Math.floor(random() * 255) + 1;
  }
  return position;
}

export function transformToTextrue(data, width, height) {
  const texture = new THREE.DataTexture(data, width, height);
  texture.needsUpdate = true;
  return texture;
}

export function zip(a, b) {
  return a.map(function (e, i) {
    return [e, b[i]];
  });
}
