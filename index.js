// camera properties
let alpha = 0.3;
let beta = 0.5;
let camDist = 5.0;

async function run() {
    // Canvas
    const body = document.body;

    const canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    body.appendChild(canvas);

    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);

        gl.uniform2f(programInfo.uniformLocations.resolution, canvas.width, canvas.height);
    });

    const gl = canvas.getContext('webgl');
    if (!gl) console.error('Unable to initialize WebGL!');

    // Mouse
    let isMousePressed = false;
    let isMouseDragged = false;
    let mouseX, mouseY;
    let isRolling = 10;

    document.addEventListener('mousedown', (event) => {
        if (event.button == 0) isMousePressed = true;
    });

    document.addEventListener('mouseup', (event) => {
        if (event.button == 0) {
            isMousePressed = false;
            isMouseDragged = false;
        }
    });

    document.addEventListener('mousemove', (event) => {
        if (isMousePressed) {
            if (!isMouseDragged) {
                isMouseDragged = true;
                mouseX = event.clientX;
                mouseY = event.clientY;

                requestAnimationFrame(render);
            }

            const dX = event.clientX - mouseX;
            const dY = event.clientY - mouseY;

            alpha -= dX * .15 / canvas.height * Math.min(camDist * camDist, 37);
            beta += dY * .15 / canvas.height * Math.min(camDist * camDist, 37);
            alpha %= 2.0 * Math.PI;
            beta = Math.min(Math.max(beta, -(Math.PI / 2.0) + .001), (Math.PI / 2.0) - .001);

            mouseX = event.clientX;
            mouseY = event.clientY;
        }
    });

    document.addEventListener('wheel', (event) => {
        camDist *= (1.0 + event.deltaY / 1000.0);
        camDist = Math.min(Math.max(camDist, 1.75), 10.0);

        isRolling = 2;
    });


    // Shader Territory
    async function loadShaderFile(path) {
        return fetch(path).then((response) => response.text()).catch((error => console.error('Error fetching shader at ${path}: ', error)));
    }

    function compileShader(gl, source, type) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('An error occured compiling the shaders: ' + gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    function linkProgram(gl, vertexShader, fragmentShader) {
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(program));
            return null;
        }

        return program;
    }

    const vertexShaderSource = await loadShaderFile('shader.vert');
    const fragmentShaderSource = await loadShaderFile('shader.frag');

    const vertexShader = compileShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER);

    const shaderProgram = linkProgram(gl, vertexShader, fragmentShader);
    gl.useProgram(shaderProgram);

    const programInfo = {
        program: shaderProgram,
        attribLocations: {
            vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition')
        },
        uniformLocations: {
            camPos: gl.getUniformLocation(shaderProgram, 'uCamPos'),
            lookAt: gl.getUniformLocation(shaderProgram, 'uLookAt'),
            FOV: gl.getUniformLocation(shaderProgram, 'uFOV'),
            resolution: gl.getUniformLocation(shaderProgram, 'uResolution'),
            sunDir: gl.getUniformLocation(shaderProgram, 'uSunDir'),
            dayEarth: gl.getUniformLocation(shaderProgram, 'uDayEarth'),
            nightEarth: gl.getUniformLocation(shaderProgram, 'uNightEarth'),
            skyBox: gl.getUniformLocation(shaderProgram, 'uSkyBox'),
            clouds: gl.getUniformLocation(shaderProgram, 'uClouds'),
            sun: gl.getUniformLocation(shaderProgram, 'uSun')
        }
    };

    // Buffers
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

    const vertices = [-1.0, 1.0, 1.0, 1.0, -1.0, -1.0, 1.0, -1.0];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    gl.useProgram(shaderProgram);

    // Attributes and Uniforms
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
    gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 2, gl.FLOAT, false, 0, 0);

    gl.uniform3f(programInfo.uniformLocations.camPos, camDist * Math.cos(beta) * Math.cos(alpha), camDist * Math.sin(beta), camDist * Math.cos(beta) * Math.sin(alpha));
    gl.uniform3f(programInfo.uniformLocations.lookAt, 0.0, 0.0, 0.0);
    gl.uniform1f(programInfo.uniformLocations.FOV, Math.PI / 3.0);

    gl.uniform2f(programInfo.uniformLocations.resolution, canvas.width, canvas.height);
    gl.uniform3f(programInfo.uniformLocations.sunDir, 1.0, 0.0, 0.0);

    gl.uniform1i(programInfo.uniformLocations.dayEarth, 0);
    gl.uniform1i(programInfo.uniformLocations.nightEarth, 1);
    gl.uniform1i(programInfo.uniformLocations.skyBox, 2);
    gl.uniform1i(programInfo.uniformLocations.clouds, 3);
    gl.uniform1i(programInfo.uniformLocations.sun, 4);

    // Load texture
    const de_texture = gl.createTexture();
    const day_earth = new Image();
    day_earth.src = "day_earth.jpg";
    day_earth.onload = function () {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, de_texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, day_earth);
        gl.generateMipmap(gl.TEXTURE_2D);

        const ne_texture = gl.createTexture();
        const night_earth = new Image();
        night_earth.src = "night_earth.jpg";
        night_earth.onload = function () {
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, ne_texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, night_earth);
            gl.generateMipmap(gl.TEXTURE_2D);


            const sb_texture = gl.createTexture();
            const skybox = new Image();
            skybox.src = "skybox.jpg";
            skybox.onload = function () {
                gl.activeTexture(gl.TEXTURE2);
                gl.bindTexture(gl.TEXTURE_2D, sb_texture);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, skybox);
                gl.generateMipmap(gl.TEXTURE_2D);

                const cl_texture = gl.createTexture();
                const clouds = new Image();
                clouds.src = "earth_clouds.jpg";
                clouds.onload = function () {
                    gl.activeTexture(gl.TEXTURE3);
                    gl.bindTexture(gl.TEXTURE_2D, cl_texture);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, clouds);
                    gl.generateMipmap(gl.TEXTURE_2D);

                    const sn_texture = gl.createTexture();
                    const sun = new Image();
                    sun.src = "sun.jpg";
                    sun.onload = function () {
                        gl.activeTexture(gl.TEXTURE4);
                        gl.bindTexture(gl.TEXTURE_2D, sn_texture);
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
                        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sun);
                        gl.generateMipmap(gl.TEXTURE_2D);

                        requestAnimationFrame(render);
                    }
                }
            }
        }
    }

    function getProgressionInYear() {
        const currentDate = new Date();

        // Get the start and end of the current year
        const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
        const endOfYear = new Date(currentDate.getFullYear() + 1, 0, 0);

        const yearDuration = endOfYear - startOfYear;
        const currentTime = currentDate - startOfYear;

        return currentTime / yearDuration;
    }

    var previousDelta = 0;
    const fpsLimit = 48;

    function render(currentDelta) {
        requestAnimationFrame(render);
        var delta = currentDelta - previousDelta;

        if (fpsLimit && delta < 1000.0 / fpsLimit) return; // limit fps
        if (isRolling == 0 && !isMouseDragged) return; // don't render if not needed
        else isRolling--;

        // Clear Canvas
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Draw the Mesh
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // Set Uniforms
        //const secInDay = 6.5 * 3600;
        const now = new Date(new Date().valueOf() + new Date().getTimezoneOffset() * 60000);
        const secInDay = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
        const dayAngle = (secInDay / 86400.0) * 2.0 * Math.PI;
        const tilt = Math.cos((getProgressionInYear() + .0274) * 2.0 * Math.PI) * Math.sin(.41);
        const tiltAngleCos = Math.cos(Math.asin(tilt));
        gl.uniform3f(programInfo.uniformLocations.sunDir, tiltAngleCos * Math.cos(-dayAngle), tilt, tiltAngleCos * Math.sin(-dayAngle));

        gl.uniform3f(programInfo.uniformLocations.camPos, camDist * Math.cos(beta) * Math.cos(alpha), camDist * Math.sin(beta), camDist * Math.cos(beta) * Math.sin(alpha));

        previousDelta = currentDelta;
    }

    requestAnimationFrame(render);
}

run();