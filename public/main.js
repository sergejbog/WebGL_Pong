function vec2ToArr(v) {
    if (Array.isArray(v)) {
        var arr_1 = [];
        v.forEach(function (e) {
            arr_1.push(e.x, e.y);
        });
        return arr_1;
    }
    else {
        return [v.x, v.y];
    }
}
navigator.mediaDevices.getUserMedia({
    audio: {
        autoGainControl: false,
        echoCancellation: false,
        noiseSuppression: false
    }
});
var sounds = {
    ballHit1: new Audio("/sounds/ballHit1.mp3"),
    ballHit2: new Audio("/sounds/ballHit2.mp3"),
    score: new Audio("/sounds/score.mp3"),
    wall: new Audio("/sounds/wall.mp3")
};
function playSound(sound) {
    if (sound === "ballHit") {
        var rand = Math.random();
        if (rand < 0.5) {
            if (sounds.ballHit1 && sounds.ballHit1.readyState) {
                sounds.ballHit1.currentTime = 0;
                sounds.ballHit1.play();
            }
        }
        else {
            if (sounds.ballHit2 && sounds.ballHit2.readyState) {
                sounds.ballHit2.currentTime = 0;
                sounds.ballHit2.play();
            }
        }
    }
    if (sound === "score") {
        if (sounds.score && sounds.score.readyState) {
            sounds.score.currentTime = 0;
            sounds.score.play();
        }
    }
    if (sound === "wall") {
        if (sounds.wall && sounds.wall.readyState) {
            sounds.wall.currentTime = 0;
            sounds.wall.play();
        }
    }
}
var canvas = document.querySelector("#glcanvas");
// Initialize the GL context
var gl = canvas.getContext("webgl");
var extAngle = gl.getExtension("ANGLE_instanced_arrays");
var extVAO = gl.getExtension("OES_vertex_array_object");
var screenWidth = gl.canvas.width;
var screenHeight = gl.canvas.height;
// Ball data
var ballOffset;
var ballVelocity;
var initialBallVelocity = { x: 4.5, y: 4.5 };
var paddleSpeed = 5.0;
var paddleHeight = 80.0;
var paddleWidth = 15.0;
var paddleOffset;
var paddleVelocities;
var paddleKeyState = {};
setupKeyEvents(paddleKeyState);
var leftScore = 0;
var rightScore = 0;
if (gl === null) {
    alert("Unable to initialize WebGL. Your browser or machine may not support it.");
}
function setOrthographicProjection(program, left, right, bottom, top, near, far) {
    var projectionMatrix = mat4.create();
    mat4.ortho(projectionMatrix, left, right, bottom, top, near, far);
    console.log(projectionMatrix);
    gl.uniformMatrix4fv(gl.getUniformLocation(program, "uProjectionMatrix"), false, projectionMatrix);
}
function createBuffer(type, data, drawType) {
    var buffer = gl.createBuffer();
    gl.bindBuffer(type, buffer);
    gl.bufferData(type, data, drawType);
    return buffer;
}
function setAttribute(buffer, location, target, size, type, stride, offset, divisor) {
    if (divisor === void 0) { divisor = 0; }
    gl.enableVertexAttribArray(location);
    gl.bindBuffer(target, buffer);
    gl.vertexAttribPointer(location, size, type, false, stride, offset);
    if (divisor !== 0)
        extAngle.vertexAttribDivisorANGLE(location, divisor);
}
function processInput() {
    paddleVelocities = [0, 0];
    //add boundry check
    if (paddleKeyState["w"] && paddleOffset[0].y < screenHeight - paddleHeight / 2) {
        paddleVelocities[0] = paddleSpeed;
    }
    if (paddleKeyState["s"] && paddleOffset[0].y > paddleHeight / 2) {
        paddleVelocities[0] = -paddleSpeed;
    }
    if (paddleKeyState["ArrowUp"] && paddleOffset[1].y < screenHeight - paddleHeight / 2) {
        paddleVelocities[1] = paddleSpeed;
    }
    if (paddleKeyState["ArrowDown"] && paddleOffset[1].y > paddleHeight / 2) {
        paddleVelocities[1] = -paddleSpeed;
    }
}
function setupKeyEvents(keyState) {
    window.addEventListener("keydown", function (e) {
        keyState[e.key] = true;
    }, true);
    window.addEventListener("keyup", function (e) {
        keyState[e.key] = false;
    }, true);
}
function gen2DCircleArray(noTriangles, radius) {
    if (radius === void 0) { radius = 0.5; }
    var circleArray = [];
    var indices = [];
    var angle = (2 * Math.PI) / noTriangles;
    for (var i = 0; i < noTriangles; i++) {
        circleArray.push(0, 0, radius * Math.cos(angle * i), radius * Math.sin(angle * i), radius * Math.cos(angle * (i + 1)), radius * Math.sin(angle * (i + 1)));
        indices.push(i * 3, i * 3 + 1, i * 3 + 2);
    }
    return [circleArray, indices];
}
function updateOffsetBuffer(vao, offset, offsetLocation) {
    extVAO.bindVertexArrayOES(vao);
    var offsetBuffer = createBuffer(gl.ARRAY_BUFFER, new Float32Array(vec2ToArr(offset)), gl.STATIC_DRAW);
    setAttribute(offsetBuffer, offsetLocation, gl.ARRAY_BUFFER, 2, gl.FLOAT, 0, 0, 1);
    extVAO.bindVertexArrayOES(null);
}
function draw(vao, primitiveType, indices, indicesType, offset, instances) {
    extVAO.bindVertexArrayOES(vao);
    extAngle.drawElementsInstancedANGLE(primitiveType, indices, indicesType, offset, instances);
    extVAO.bindVertexArrayOES(null);
}
function updateScore() {
    document.getElementById("left-player").innerText = leftScore.toString();
    document.getElementById("right-player").innerText = rightScore.toString();
}
function main() {
    var program = webglUtils.createProgramFromScripts(gl, ["vertex-shader", "fragment-shader"]);
    // Ball data
    var _a = gen2DCircleArray(100), ballVertices = _a[0], ballIndices = _a[1];
    ballOffset = { x: screenWidth / 2, y: screenHeight / 2 };
    var ballSize = { x: 20, y: 20 };
    ballVelocity = { x: initialBallVelocity.x, y: initialBallVelocity.y };
    // Paddle data
    var paddleVertices = [-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5];
    var paddleIndices = [0, 1, 2, 0, 2, 3];
    paddleOffset = [
        { x: 35.0, y: screenHeight / 2 },
        { x: screenWidth - 35.0, y: screenHeight / 2 },
    ];
    var paddleSize = { x: paddleWidth, y: paddleHeight };
    var halfPaddleWidth = paddleWidth / 2;
    var halfPaddleHeight = paddleHeight / 2;
    paddleVelocities = [0, 0];
    // Middle lines data
    var middleLineVertices = [-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5];
    var middleLineIndices = [0, 1, 2, 0, 2, 3];
    var middleLineSize = { x: 10, y: 20 };
    var middleLineOffset = [];
    var numOfMiddleLines = screenHeight / (middleLineSize.y + 20);
    for (var i = 0; i <= numOfMiddleLines; i++) {
        middleLineOffset.push({ x: screenWidth / 2, y: i * (middleLineSize.y + 20) });
    }
    console.log(middleLineOffset);
    // Set up buffers for the ball
    var ballVAO = extVAO.createVertexArrayOES();
    extVAO.bindVertexArrayOES(ballVAO);
    var ballVerticesBuffer = createBuffer(gl.ARRAY_BUFFER, new Float32Array(ballVertices), gl.STATIC_DRAW);
    var ballSizeBuffer = createBuffer(gl.ARRAY_BUFFER, new Float32Array(vec2ToArr(ballSize)), gl.STATIC_DRAW);
    var ballOffsetBuffer = createBuffer(gl.ARRAY_BUFFER, new Float32Array(vec2ToArr(ballOffset)), gl.STATIC_DRAW);
    var ballIndicesBuffer = createBuffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(ballIndices), gl.STATIC_DRAW);
    // End of ball buffers
    // Set up the attributes for the ball
    var ballVerticesLocation = gl.getAttribLocation(program, "position");
    setAttribute(ballVerticesBuffer, ballVerticesLocation, gl.ARRAY_BUFFER, 2, gl.FLOAT, 0, 0);
    var ballSizeLocation = gl.getAttribLocation(program, "size");
    setAttribute(ballSizeBuffer, ballSizeLocation, gl.ARRAY_BUFFER, 2, gl.FLOAT, 0, 0, 1);
    var ballOffsetLocation = gl.getAttribLocation(program, "offset");
    setAttribute(ballOffsetBuffer, ballOffsetLocation, gl.ARRAY_BUFFER, 2, gl.FLOAT, 0, 0, 1);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ballIndicesBuffer);
    extVAO.bindVertexArrayOES(null);
    // End of ball attributes
    // Set up buffers for the paddle
    var paddleVAO = extVAO.createVertexArrayOES();
    extVAO.bindVertexArrayOES(paddleVAO);
    var paddleVerticesBuffer = createBuffer(gl.ARRAY_BUFFER, new Float32Array(paddleVertices), gl.STATIC_DRAW);
    var paddleSizeBuffer = createBuffer(gl.ARRAY_BUFFER, new Float32Array(vec2ToArr(paddleSize)), gl.STATIC_DRAW);
    var paddleOffsetBuffer = createBuffer(gl.ARRAY_BUFFER, new Float32Array(vec2ToArr(paddleOffset)), gl.STATIC_DRAW);
    var paddleIndicesBuffer = createBuffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(paddleIndices), gl.STATIC_DRAW);
    // // End of paddle buffers
    // // Set up the attributes for the paddle
    var paddleVerticesLocation = gl.getAttribLocation(program, "position");
    setAttribute(paddleVerticesBuffer, paddleVerticesLocation, gl.ARRAY_BUFFER, 2, gl.FLOAT, 0, 0);
    var paddleSizeLocation = gl.getAttribLocation(program, "size");
    setAttribute(paddleSizeBuffer, paddleSizeLocation, gl.ARRAY_BUFFER, 2, gl.FLOAT, 0, 0, 2);
    var paddleOffsetLocation = gl.getAttribLocation(program, "offset");
    setAttribute(paddleOffsetBuffer, paddleOffsetLocation, gl.ARRAY_BUFFER, 2, gl.FLOAT, 0, 0, 1);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, paddleIndicesBuffer);
    extVAO.bindVertexArrayOES(null);
    // End of paddle attributes
    // Set up buffers for the middle lines
    var middleLineVAO = extVAO.createVertexArrayOES();
    extVAO.bindVertexArrayOES(middleLineVAO);
    var middleLineVerticesBuffer = createBuffer(gl.ARRAY_BUFFER, new Float32Array(middleLineVertices), gl.STATIC_DRAW);
    var middleLineSizeBuffer = createBuffer(gl.ARRAY_BUFFER, new Float32Array(vec2ToArr(middleLineSize)), gl.STATIC_DRAW);
    var middleLineOffsetBuffer = createBuffer(gl.ARRAY_BUFFER, new Float32Array(vec2ToArr(middleLineOffset)), gl.STATIC_DRAW);
    var middleLineIndicesBuffer = createBuffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(middleLineIndices), gl.STATIC_DRAW);
    // // End of middle line buffers
    // // Set up the attributes for the middle lines
    var middleLineVerticesLocation = gl.getAttribLocation(program, "position");
    setAttribute(middleLineVerticesBuffer, middleLineVerticesLocation, gl.ARRAY_BUFFER, 2, gl.FLOAT, 0, 0);
    var middleLineSizeLocation = gl.getAttribLocation(program, "size");
    setAttribute(middleLineSizeBuffer, middleLineSizeLocation, gl.ARRAY_BUFFER, 2, gl.FLOAT, 0, 0, numOfMiddleLines + 1);
    var middleLineOffsetLocation = gl.getAttribLocation(program, "offset");
    setAttribute(middleLineOffsetBuffer, middleLineOffsetLocation, gl.ARRAY_BUFFER, 2, gl.FLOAT, 0, 0, 1);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, middleLineIndicesBuffer);
    extVAO.bindVertexArrayOES(null);
    // End of middle line attributes
    webglUtils.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.useProgram(program);
    setOrthographicProjection(program, 0, screenWidth, 0, screenHeight, 0.0, 1.0);
    function animate() {
        requestAnimationFrame(animate);
        // Update the time
        // Update the ball position
        ballOffset.x += ballVelocity.x;
        ballOffset.y += ballVelocity.y;
        updateOffsetBuffer(ballVAO, ballOffset, ballOffsetLocation);
        // Update the paddle position
        processInput();
        paddleOffset[0].y += paddleVelocities[0];
        paddleOffset[1].y += paddleVelocities[1];
        updateOffsetBuffer(paddleVAO, paddleOffset, paddleOffsetLocation);
        /*
           Check for collisions
        */
        // Check for collision with the top and bottom of the screen
        if (ballOffset.y + ballSize.y / 2 >= screenHeight || ballOffset.y - ballSize.y / 2 <= 0) {
            ballVelocity.y *= -1;
            playSound("wall");
        }
        // Check for collision with the paddle
        var i = 0;
        if (ballOffset.x > screenWidth / 2) {
            i = 1;
        }
        var distance = { x: Math.abs(ballOffset.x - paddleOffset[i].x), y: Math.abs(ballOffset.y - paddleOffset[i].y) };
        if (distance.x <= halfPaddleWidth + ballSize.x / 2 && distance.y <= halfPaddleHeight + ballSize.y / 2) {
            var collision = false;
            if (distance.x <= halfPaddleWidth && distance.x >= halfPaddleWidth - ballSize.y / 2) {
                collision = true;
                ballVelocity.x = i == 0 ? Math.abs(ballVelocity.x) : -Math.abs(ballVelocity.x);
            }
            else if (distance.y <= halfPaddleHeight && distance.y >= halfPaddleHeight - ballSize.y / 2) {
                collision = true;
                ballVelocity.x = i == 0 ? Math.abs(ballVelocity.x) : -Math.abs(ballVelocity.x);
                ballVelocity.y = i == 0 ? Math.abs(ballVelocity.y) : -Math.abs(ballVelocity.y);
            }
            var squaredDistance = (distance.x - halfPaddleWidth) * (distance.x - halfPaddleWidth) + (distance.y - halfPaddleHeight) * (distance.y - halfPaddleHeight);
            if (squaredDistance <= (ballSize.x * ballSize.x) / 4 && !collision) {
                collision = true;
                console.log(ballOffset.x, paddleOffset[i].x, ballOffset.y, paddleOffset[i].y);
                var signedDifference = paddleOffset[i].x - ballOffset.x;
                if (i == 0) {
                    signedDifference *= -1;
                }
                if (distance.y - halfPaddleHeight <= signedDifference - halfPaddleWidth) {
                    ballVelocity.x = i == 0 ? Math.abs(ballVelocity.x) : -Math.abs(ballVelocity.x);
                }
                else {
                    ballVelocity.x = i == 0 ? Math.abs(ballVelocity.x) : -Math.abs(ballVelocity.x);
                    ballVelocity.y = i == 0 ? Math.abs(ballVelocity.y) : -Math.abs(ballVelocity.y);
                }
            }
            if (collision) {
                var k = 0.05;
                playSound("ballHit");
                ballVelocity.x *= 1.01;
                ballVelocity.y += k * paddleVelocities[i];
            }
        }
        var reset = 0;
        // Check for collision with the left and right of the screen
        if (ballOffset.x - ballSize.x / 2 <= 0) {
            reset = 1;
            rightScore++;
        }
        if (ballOffset.x + ballSize.x / 2 >= screenWidth) {
            reset = 2;
            leftScore++;
        }
        if (reset) {
            ballOffset.x = screenWidth / 2;
            ballOffset.y = screenHeight / 2;
            ballVelocity.x = reset == 1 ? initialBallVelocity.x : -initialBallVelocity.x;
            ballVelocity.y = initialBallVelocity.y;
            updateScore();
            playSound("score");
        }
        // Black out the screen
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        // Draw the ball and the paddle
        draw(ballVAO, gl.TRIANGLES, ballIndices.length, gl.UNSIGNED_SHORT, 0, 1);
        draw(paddleVAO, gl.TRIANGLES, paddleIndices.length, gl.UNSIGNED_SHORT, 0, 2);
        draw(middleLineVAO, gl.TRIANGLES, middleLineIndices.length, gl.UNSIGNED_SHORT, 0, numOfMiddleLines + 1);
    }
    animate();
}
main();
