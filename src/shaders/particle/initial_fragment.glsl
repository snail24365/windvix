varying vec2 v_uv;
uniform sampler2D tx; 



void main () {
    // gl_FragColor = texture2D(tx, v_uv);
    gl_FragColor = vec4(.5,.3,.2,1.);
}