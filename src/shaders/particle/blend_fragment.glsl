
varying vec2 v_uv;

uniform float u_previous_screen_alpha;
uniform sampler2D u_previous_screen;
uniform sampler2D u_current_screen;

void main () {
    vec4 prev = texture2D(u_previous_screen, v_uv);
    vec4 current = texture2D(u_current_screen, v_uv);
    gl_FragColor = vec4(mix(current, prev, 0.7).rgb, 1.);
    // gl_FragColor = current;
}