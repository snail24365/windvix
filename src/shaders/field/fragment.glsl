uniform sampler2D positionBuffer;
uniform sampler2D windVelocity;

uniform float vxMax;
uniform float vxMin;

uniform float vyMax;
uniform float vyMin;

varying vec2 v_uv;

float getlinearTransformation(float maxV, float minV, float r, float g) {
    return  minV + (maxV - minV) * (r * 256. * 256. + g * 256.) / (256.* 256. - 1. );
}

void main () {
    vec4 particle = texture2D(positionBuffer, v_uv);
    vec4 wind = texture2D(windVelocity, v_uv);

    float vx = getlinearTransformation(vxMax, vxMin, wind.r, wind.g);
    float vy = getlinearTransformation(vyMax, vyMin, wind.b, wind.a);

    gl_FragColor = vec4(wind.r, wind.b, 0, 1.0);
}