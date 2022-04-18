uniform sampler2D particlePos;
uniform sampler2D windVelocity;

uniform vec2 windResolution;
uniform float vxMax;
uniform float vxMin;

uniform float vyMax;
uniform float vyMin;
uniform float aspectRatio;

uniform float randomSeed;
uniform float timeGap;
uniform float maxSpeed;

uniform float u_drop_rate;
uniform float u_drop_rate_bump;
uniform float u_time;
uniform float u_speed_scale;

varying vec2 v_uv;

float rand(const vec2 co) {
    float t = dot(vec2(12.9898, 78.233), co);
    return fract(sin(t) * (4375.85453 + t));
}

float colorToVelocity(float maxV, float minV, float r, float g) {
    return  minV + (maxV - minV) * (r * 256. * 256. + g * 256.) / (256.* 256. - 1.);
}

vec2 colorToVelocityVec2(vec4 wind) {
    float vx = colorToVelocity(vxMax, vxMin, wind.r, wind.g);
    float vy = colorToVelocity(vyMax, vyMin, wind.b, wind.a);
    return vec2(vx,vy);
}

vec2 lookUpWind(vec2 pos) {
    vec2 cellLength = 1.0 / windResolution;
    vec2 mr = pos * windResolution;
    vec2 base = floor(mr) * cellLength;
    vec2 offset = fract(mr);

    vec4 c_wind_bl = texture2D(windVelocity, base);
    vec4 c_wind_br = texture2D(windVelocity, base + vec2(cellLength.x, 0));
    vec4 c_wind_tl = texture2D(windVelocity, base + vec2(0, cellLength.y));
    vec4 c_wind_tr = texture2D(windVelocity, base + cellLength);

    vec2 wind_bl = colorToVelocityVec2(c_wind_bl);
    vec2 wind_br = colorToVelocityVec2(c_wind_br);
    vec2 wind_tl = colorToVelocityVec2(c_wind_tl);
    vec2 wind_tr = colorToVelocityVec2(c_wind_tr);

    return mix(mix(wind_bl, wind_br, offset.x), mix(wind_tl, wind_tr, offset.x), offset.y);
}

void main () {
    vec4 particle = texture2D(particlePos, v_uv);
    vec2 pos = vec2(
        particle.r / 255.0 + particle.b, 
        particle.g / 255.0 + particle.a);

    vec2 wind = lookUpWind(pos);
    float distortion = cos(radians(pos.y * 180.0 - 90.0));
    wind.y *= distortion;

    vec2 delta = u_speed_scale * timeGap * wind;
    vec2 newPos = fract(1.0 + pos + delta);
    
    float speed_t = length(wind) / maxSpeed;

    vec2 seed = u_time * v_uv * randomSeed;

    
    
    float drop_rate = u_drop_rate * 0.001 + speed_t * u_drop_rate_bump;
    

    if (abs(delta.x) + abs(delta.y) < 0.00003) {
        drop_rate += 0.005;
    }

    float drop = step(1.0 - drop_rate, rand(seed));

    vec2 random_pos = vec2(
        rand(seed + 21.9),
        rand(seed + 43.7));
    newPos = mix(newPos, random_pos, drop);

    gl_FragColor = vec4(
        fract(newPos * 255.0),
        floor(newPos * 255.0) / 255.0);
}