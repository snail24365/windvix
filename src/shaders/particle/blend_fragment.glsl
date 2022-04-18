
varying vec2 v_uv;

uniform float u_previous_screen_alpha;
uniform sampler2D u_previous_screen;

void main () {
    vec4 prev = texture2D(u_previous_screen, v_uv);
    float new_alpha = prev.a * u_previous_screen_alpha;
    new_alpha = new_alpha * step(0.01, u_previous_screen_alpha);
    gl_FragColor = vec4(prev.r, prev.g, prev.b, prev.a * u_previous_screen_alpha);
}