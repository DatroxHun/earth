precision highp float;

#define PI 3.14159265359

// camera
uniform vec3 uCamPos;
uniform vec3 uLookAt;
uniform float uFOV;

// misc
uniform vec2 uResolution;
uniform sampler2D uDayEarth;
uniform sampler2D uNightEarth;
uniform sampler2D uSkyBox;
uniform sampler2D uClouds;
uniform sampler2D uSun;

// sphere
float radius = 1.0;
vec3 spherePos = vec3(0.0);

// sun
uniform vec3 uSunDir;
vec3 sunColor = 15. * vec3(.99, .72, .075);
float sunSize = .0025;

float clamp(float a)
{
    return min(max(a, 0.0), 1.0);
}

float map(float a, float iMin, float iMax, float oMin, float oMax)
{
    return oMin + (a - iMin) / (iMax - iMin) * (oMax - oMin);
}

void main(void)
{
    vec3 color = vec3(0.0);
    vec3 sunDir = normalize(uSunDir);

    float aspect = uResolution.x / uResolution.y;
    vec2 uv = gl_FragCoord.xy / uResolution.xy;

    vec3 up = vec3(0.0, 1.0, 0.0);
    float focal_length = 3.0;
    vec3 lookDir = normalize(uLookAt - uCamPos);

    vec3 half_horizontal = normalize(cross(up, lookDir)) * tan(uFOV / 2.0) * focal_length;
    vec3 half_vertical = normalize(cross(lookDir, half_horizontal)) * tan(uFOV / 2.0) * focal_length / aspect;

    vec2 centeredUV = (uv - vec2(0.5));
    vec3 screenPos = uCamPos + lookDir * focal_length + 2.0 * (centeredUV.x * half_horizontal + centeredUV.y * half_vertical);
    vec3 rayDir = normalize(screenPos - uCamPos);

    // intersection
    float half_b = dot(uCamPos - spherePos, rayDir);
    float c = dot(uCamPos - spherePos, uCamPos - spherePos) - radius * radius;
    float det = half_b * half_b - c;
    if (det < 0.0)
    {
        vec2 skyboxUV = vec2(atan(rayDir.z, rayDir.x) / (2.0 * PI) + 0.5, asin(rayDir.y) / PI + 0.5);
        float val = max(dot(rayDir, -sunDir) - 1.0 + sunSize, 0.0) / sunSize;
        color = mix(texture2D(uSkyBox, vec2(1.0 - skyboxUV.x, 1.0 - skyboxUV.y)).xyz, sunColor + texture2D(uSun, 50. * skyboxUV + vec2(.5)).xyz, pow(val, 10.));
    }
    else
    {
        float t = -half_b - sqrt(det);
        vec3 point = uCamPos + rayDir * t;
        vec3 normal = normalize(point - spherePos);
        vec2 sphereUV = vec2(atan(normal.z, normal.x) / (2.0 * PI) + 0.5, asin(normal.y) / PI + 0.5);

        float val = dot(-sunDir, normal);
        vec3 dayColor = texture2D(uDayEarth, vec2(sphereUV.x, 1.0 - sphereUV.y)).xyz;
        vec3 nightColor = texture2D(uNightEarth, vec2(sphereUV.x, 1.0 - sphereUV.y)).xyz;
        color = (max(.75 * val + .25, 0.0) * dayColor + max(-1.5 * val, 0.0) * nightColor) +
                max(dayColor.z - .25 * (dayColor.x + dayColor.z), .1) * max(val, 0.0) * texture2D(uClouds, vec2(sphereUV.x, 1.0 - sphereUV.y)).xyz;
    }

    // gamma correnction
    float gamma = 1.33;
    gl_FragColor = vec4(pow(color.x, gamma), pow(color.y, gamma), pow(color.z, gamma), 1.0);
}