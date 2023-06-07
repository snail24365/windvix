varying vec2 v_uv;
uniform sampler2D positionBuffer;
uniform sampler2D windVelocity;

void main () {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

    vec4 particle = texture2D(positionBuffer, v_uv);
    v_uv = uv;
}