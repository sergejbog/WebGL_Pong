declare var mat4: any;
declare var webglUtils: any;

interface vec2 {
   x: number;
   y: number;
}

function vec2ToArr(v: vec2 | vec2[]) {
   if (Array.isArray(v)) {
      const arr: number[] = [];
      v.forEach((e) => {
         arr.push(e.x, e.y);
      });
      return arr;
   } else {
      return [v.x, v.y];
   }
}

navigator.mediaDevices.getUserMedia({
   audio: {
      autoGainControl: false,
      echoCancellation: false,
      noiseSuppression: false,
   },
});

let sounds = {
   ballHit1: new Audio("/sounds/ballHit1.mp3"),
   ballHit2: new Audio("/sounds/ballHit2.mp3"),
   score: new Audio("/sounds/score.mp3"),
   wall: new Audio("/sounds/wall.mp3"),
};

function playSound(sound: string) {
   if (sound === "ballHit") {
      let rand = Math.random();
      if (rand < 0.5) {
         if (sounds.ballHit1 && sounds.ballHit1.readyState) {
            sounds.ballHit1.currentTime = 0;
            sounds.ballHit1.play();
         }
      } else {
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

const canvas = <HTMLCanvasElement>document.querySelector("#glcanvas");
// Initialize the GL context
const gl = canvas.getContext("webgl");
const extAngle = gl.getExtension("ANGLE_instanced_arrays");
const extVAO = gl.getExtension("OES_vertex_array_object");

const screenWidth = gl.canvas.width;
const screenHeight = gl.canvas.height;

// Ball data
let ballOffset: vec2;
let ballVelocity: vec2;
let ballRadius = 10.0;
let initialBallVelocity: vec2 = { x: 4.5, y: 4.5 };
const ballSpeed = 10.5;
const MAX_ANGLE = 30;

const paddleSpeed = 8.0;
const paddleHeight = 80.0;
const paddleWidth = 15.0;
let paddleOffset: vec2[];
let paddleVelocities: number[];
const paddleKeyState = {};
setupKeyEvents(paddleKeyState);

let leftScore = 0;
let rightScore = 0;

if (gl === null) {
   alert("Unable to initialize WebGL. Your browser or machine may not support it.");
}

function setOrthographicProjection(program: WebGLProgram, left: number, right: number, bottom: number, top: number, near: number, far: number) {
   const projectionMatrix = mat4.create();
   mat4.ortho(projectionMatrix, left, right, bottom, top, near, far);
   console.log(projectionMatrix);
   gl.uniformMatrix4fv(gl.getUniformLocation(program, "uProjectionMatrix"), false, projectionMatrix);
}

function createBuffer(type: number, data: ArrayBuffer, drawType: number) {
   const buffer = gl.createBuffer();
   gl.bindBuffer(type, buffer);
   gl.bufferData(type, data, drawType);
   return buffer;
}

function setAttribute(buffer: WebGLBuffer, location: number, target: number, size: number, type: number, stride: number, offset: number, divisor = 0) {
   gl.enableVertexAttribArray(location);
   gl.bindBuffer(target, buffer);
   gl.vertexAttribPointer(location, size, type, false, stride, offset);
   if (divisor !== 0) extAngle.vertexAttribDivisorANGLE(location, divisor);
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

function setupKeyEvents(keyState: { [x: string]: boolean }) {
   window.addEventListener(
      "keydown",
      function (e) {
         keyState[e.key] = true;
      },
      true
   );
   window.addEventListener(
      "keyup",
      function (e) {
         keyState[e.key] = false;
      },
      true
   );
}

function gen2DCircleArray(noTriangles: number, radius: number) {
   const circleArray = [];
   const indices = [];
   const angle = (2 * Math.PI) / noTriangles;
   for (let i = 0; i < noTriangles; i++) {
      circleArray.push(0, 0, radius * Math.cos(angle * i), radius * Math.sin(angle * i), radius * Math.cos(angle * (i + 1)), radius * Math.sin(angle * (i + 1)));
      indices.push(i * 3, i * 3 + 1, i * 3 + 2);
   }
   return [circleArray, indices];
}

function updateOffsetBuffer(vao: WebGLVertexArrayObjectOES, offset: vec2[] | vec2, offsetLocation: number) {
   extVAO.bindVertexArrayOES(vao);
   let offsetBuffer = createBuffer(gl.ARRAY_BUFFER, new Float32Array(vec2ToArr(offset)), gl.STATIC_DRAW);
   setAttribute(offsetBuffer, offsetLocation, gl.ARRAY_BUFFER, 2, gl.FLOAT, 0, 0, 1);
   extVAO.bindVertexArrayOES(null);
}

function draw(vao: WebGLVertexArrayObjectOES, primitiveType: number, indices: number, indicesType: number, offset: number, instances: number) {
   extVAO.bindVertexArrayOES(vao);
   extAngle.drawElementsInstancedANGLE(primitiveType, indices, indicesType, offset, instances);
   extVAO.bindVertexArrayOES(null);
}

function updateScore() {
   document.getElementById("left-player").innerText = leftScore.toString();
   document.getElementById("right-player").innerText = rightScore.toString();
}

function calculateNewVelocityAngle(i) {
   const relativeIntersectY = paddleOffset[i].y + paddleHeight / 2 - (ballOffset.y + ballRadius / 2);
   const normalizedRelativeIntersectionY = relativeIntersectY / (paddleHeight / 2);
   const bounceAngle = normalizedRelativeIntersectionY * MAX_ANGLE;
   return bounceAngle * (Math.PI / 180);
}

function main() {
   const program = webglUtils.createProgramFromScripts(gl, ["vertex-shader", "fragment-shader"]);

   // Ball data
   const [ballVertices, ballIndices] = gen2DCircleArray(100, ballRadius);
   ballOffset = { x: screenWidth / 2, y: screenHeight / 2 };
   const ballSize: vec2 = { x: 1, y: 1 };
   ballVelocity = { x: initialBallVelocity.x, y: initialBallVelocity.y };

   // Paddle data
   const paddleVertices = [-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5];
   const paddleIndices = [0, 1, 2, 0, 2, 3];
   paddleOffset = [
      { x: 35.0, y: screenHeight / 2 },
      { x: screenWidth - 35.0, y: screenHeight / 2 },
   ];
   const paddleSize: vec2 = { x: paddleWidth, y: paddleHeight };
   const halfPaddleWidth = paddleWidth / 2;
   const halfPaddleHeight = paddleHeight / 2;
   paddleVelocities = [0, 0];

   // Middle lines data
   const middleLineVertices = [-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5];
   const middleLineIndices = [0, 1, 2, 0, 2, 3];
   const middleLineSize: vec2 = { x: 10, y: 20 };
   const middleLineOffset: vec2[] = [];

   let numOfMiddleLines = screenHeight / (middleLineSize.y + 20);
   for (let i = 0; i <= numOfMiddleLines; i++) {
      middleLineOffset.push({ x: screenWidth / 2, y: i * (middleLineSize.y + 20) });
   }

   console.log(middleLineOffset);
   // Set up buffers for the ball
   const ballVAO = extVAO.createVertexArrayOES();
   extVAO.bindVertexArrayOES(ballVAO);

   const ballVerticesBuffer = createBuffer(gl.ARRAY_BUFFER, new Float32Array(ballVertices), gl.STATIC_DRAW);
   const ballSizeBuffer = createBuffer(gl.ARRAY_BUFFER, new Float32Array(vec2ToArr(ballSize)), gl.STATIC_DRAW);
   const ballOffsetBuffer = createBuffer(gl.ARRAY_BUFFER, new Float32Array(vec2ToArr(ballOffset)), gl.STATIC_DRAW);
   const ballIndicesBuffer = createBuffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(ballIndices), gl.STATIC_DRAW);

   // End of ball buffers

   // Set up the attributes for the ball
   const ballVerticesLocation = gl.getAttribLocation(program, "position");
   setAttribute(ballVerticesBuffer, ballVerticesLocation, gl.ARRAY_BUFFER, 2, gl.FLOAT, 0, 0);

   const ballSizeLocation = gl.getAttribLocation(program, "size");
   setAttribute(ballSizeBuffer, ballSizeLocation, gl.ARRAY_BUFFER, 2, gl.FLOAT, 0, 0, 1);

   const ballOffsetLocation = gl.getAttribLocation(program, "offset");
   setAttribute(ballOffsetBuffer, ballOffsetLocation, gl.ARRAY_BUFFER, 2, gl.FLOAT, 0, 0, 1);

   gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ballIndicesBuffer);

   extVAO.bindVertexArrayOES(null);
   // End of ball attributes

   // Set up buffers for the paddle
   const paddleVAO = extVAO.createVertexArrayOES();
   extVAO.bindVertexArrayOES(paddleVAO);

   const paddleVerticesBuffer = createBuffer(gl.ARRAY_BUFFER, new Float32Array(paddleVertices), gl.STATIC_DRAW);
   const paddleSizeBuffer = createBuffer(gl.ARRAY_BUFFER, new Float32Array(vec2ToArr(paddleSize)), gl.STATIC_DRAW);
   const paddleOffsetBuffer = createBuffer(gl.ARRAY_BUFFER, new Float32Array(vec2ToArr(paddleOffset)), gl.STATIC_DRAW);
   const paddleIndicesBuffer = createBuffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(paddleIndices), gl.STATIC_DRAW);
   // // End of paddle buffers

   // // Set up the attributes for the paddle
   const paddleVerticesLocation = gl.getAttribLocation(program, "position");
   setAttribute(paddleVerticesBuffer, paddleVerticesLocation, gl.ARRAY_BUFFER, 2, gl.FLOAT, 0, 0);

   const paddleSizeLocation = gl.getAttribLocation(program, "size");
   setAttribute(paddleSizeBuffer, paddleSizeLocation, gl.ARRAY_BUFFER, 2, gl.FLOAT, 0, 0, 2);

   const paddleOffsetLocation = gl.getAttribLocation(program, "offset");
   setAttribute(paddleOffsetBuffer, paddleOffsetLocation, gl.ARRAY_BUFFER, 2, gl.FLOAT, 0, 0, 1);

   gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, paddleIndicesBuffer);

   extVAO.bindVertexArrayOES(null);
   // End of paddle attributes

   // Set up buffers for the middle lines
   const middleLineVAO = extVAO.createVertexArrayOES();
   extVAO.bindVertexArrayOES(middleLineVAO);

   const middleLineVerticesBuffer = createBuffer(gl.ARRAY_BUFFER, new Float32Array(middleLineVertices), gl.STATIC_DRAW);
   const middleLineSizeBuffer = createBuffer(gl.ARRAY_BUFFER, new Float32Array(vec2ToArr(middleLineSize)), gl.STATIC_DRAW);
   const middleLineOffsetBuffer = createBuffer(gl.ARRAY_BUFFER, new Float32Array(vec2ToArr(middleLineOffset)), gl.STATIC_DRAW);
   const middleLineIndicesBuffer = createBuffer(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(middleLineIndices), gl.STATIC_DRAW);
   // // End of middle line buffers

   // // Set up the attributes for the middle lines
   const middleLineVerticesLocation = gl.getAttribLocation(program, "position");
   setAttribute(middleLineVerticesBuffer, middleLineVerticesLocation, gl.ARRAY_BUFFER, 2, gl.FLOAT, 0, 0);

   const middleLineSizeLocation = gl.getAttribLocation(program, "size");
   setAttribute(middleLineSizeBuffer, middleLineSizeLocation, gl.ARRAY_BUFFER, 2, gl.FLOAT, 0, 0, numOfMiddleLines + 1);

   const middleLineOffsetLocation = gl.getAttribLocation(program, "offset");
   setAttribute(middleLineOffsetBuffer, middleLineOffsetLocation, gl.ARRAY_BUFFER, 2, gl.FLOAT, 0, 0, 1);

   gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, middleLineIndicesBuffer);

   extVAO.bindVertexArrayOES(null);
   // End of middle line attributes

   webglUtils.resizeCanvasToDisplaySize(gl.canvas);
   gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

   gl.useProgram(program);

   setOrthographicProjection(program, 0, screenWidth, 0, screenHeight, 0.0, 1.0);

   let lastTime = 0;

   function animate(time) {
      // Update the time
      if (lastTime == 0) lastTime = time;
      let deltaTime = time - lastTime;
      lastTime = time;

      // Update the paddle position
      processInput();
      paddleOffset[0].y += paddleVelocities[0];
      paddleOffset[1].y += paddleVelocities[1];

      updateOffsetBuffer(paddleVAO, paddleOffset, paddleOffsetLocation);

      /* 
         Check for collisions
      */

      //calculate where the ball will be in the next frame
      let nextBallOffset: vec2 = { x: ballOffset.x + ballVelocity.x, y: ballOffset.y + ballVelocity.y };

      // Check for collision with the top and bottom of the screen
      if (nextBallOffset.y + ballRadius >= screenHeight || nextBallOffset.y - ballRadius <= 0) {
         ballVelocity.y *= -1;
         playSound("wall");
      }

      // Check for collision with the paddle
      let i = 0;
      if (ballOffset.x > screenWidth / 2) {
         i = 1;
      }

      let distance: vec2 = { x: Math.abs(nextBallOffset.x - paddleOffset[i].x), y: Math.abs(nextBallOffset.y - paddleOffset[i].y) };

      if (distance.x <= halfPaddleWidth + ballRadius && distance.y <= halfPaddleHeight + ballRadius) {
         let collision = false;

         if (distance.x <= halfPaddleWidth && distance.x >= halfPaddleWidth - ballRadius) {
            collision = true;
         } else if (distance.y <= halfPaddleHeight && distance.y >= halfPaddleHeight - ballRadius) {
            collision = true;
         }

         if (collision) {
            let theta = calculateNewVelocityAngle(i);
            let newX = Math.abs(Math.cos(theta) * ballSpeed);
            let newY = -Math.sin(theta) * ballSpeed;

            ballVelocity.x = i == 0 ? newX : -newX;
            ballVelocity.y = newY;
            playSound("ballHit");
         }
      }

      let reset = 0;

      // Check for collision with the left and right of the screen
      if (ballOffset.x - ballRadius <= 0) {
         reset = 1;
         rightScore++;
      }

      if (ballOffset.x + ballRadius >= screenWidth) {
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

      // Update the ball position
      if (deltaTime > 0) {
         ballOffset.x += ballVelocity.x;
         ballOffset.y += ballVelocity.y;
         updateOffsetBuffer(ballVAO, ballOffset, ballOffsetLocation);
      }

      /* 
         End of collision checks
      */

      // Black out the screen
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      // Draw the ball,paddle and the middle lines
      draw(ballVAO, gl.TRIANGLES, ballIndices.length, gl.UNSIGNED_SHORT, 0, 1);
      draw(paddleVAO, gl.TRIANGLES, paddleIndices.length, gl.UNSIGNED_SHORT, 0, 2);
      draw(middleLineVAO, gl.TRIANGLES, middleLineIndices.length, gl.UNSIGNED_SHORT, 0, numOfMiddleLines + 1);

      requestAnimationFrame(animate);
   }

   requestAnimationFrame(animate);
}

main();
