varying vec2 v_uv;
uniform sampler2D velocityTexture;
uniform sampler2D particlePositionTexture;
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
    return 0.9;
    }
    if (x < 0.3) {
    return 0.5;
    }
    if (x < 5.) {
    return 0.2;
    }
    return 0.;
}

void main() {
    vec2 position = texture(particlePositionTexture, v_uv).xy;

    vec2 velocity = texture(velocityTexture, vec2(position.x / worldMapWidth, position.y / worldMapHeight)).xy;

    bool isInitPosition = position.x == 0.0 && position.y == 0.0;
    bool isRandomReset = random(v_uv + timingSignal * 0.1) < 0.1;
    bool isSlowReset = random(v_uv + timingSignal * 0.7 + 0.19) < slowResetProbability(velocity);
    bool isOutside = position.x <= 0.0 || position.x >= worldMapWidth || position.y <= 0.0 || position.y >= worldMapHeight;


    float alpha = 0.01;
    position += velocity * alpha;

    //  || isRandomReset || isSlowReset || isOutside
    if(isInitPosition) {
        position.x = random(v_uv + 5.23 * sin(timingSignal + 1.7) + 1.23) * worldMapWidth;
        position.y = random(v_uv + 4.57 * sin(timingSignal + 3.4) + 3.45) * worldMapHeight;     
    }

    gl_FragColor = vec4(position, length(velocity), 1.0);
}
