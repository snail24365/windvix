uniform sampler2D particlePos;
uniform sampler2D windVelocity;

uniform float vxMax;
uniform float vxMin;

uniform float vyMax;
uniform float vyMin;

uniform float aspectRatio;

varying float speed;

float linearTransformation(float maxV, float minV, float r, float g) {
    return  minV + (maxV - minV) * (r * 256. * 256. + g * 256.) / (256.* 256. - 1. );
}

void main () {
    gl_PointSize = 1.0;

    vec4 particle = texture2D(particlePos, uv);
    
    vec2 pos = vec2(
    particle.r / 255.0 + particle.b, 
    particle.g / 255.0 + particle.a);
    vec4 wind = texture2D(windVelocity, pos);

    vec2 transformedPos = (pos - 0.5); 
    transformedPos.x *= 2.0;
    
    gl_Position = projectionMatrix 
                * modelViewMatrix 
                * vec4(transformedPos, 0.0, 1.0);

    float vx = linearTransformation(vxMax, vxMin, wind.r, wind.g);
    float vy = linearTransformation(vyMax, vyMin, wind.b, wind.a);    
    speed = length(vec2(vx,vy));
}