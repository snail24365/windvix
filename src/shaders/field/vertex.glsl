varying vec2 v_uv;
uniform sampler2D particlePos;
uniform sampler2D windVelocity;

void main () {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

    vec4 particle = texture2D(particlePos, v_uv);
    v_uv = uv;
}