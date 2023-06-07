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

export function zip(a, b) {
  return a.map(function (e, i) {
    return [e, b[i]];
  });
}
