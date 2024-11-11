/*
To do:
Fix big where touch interaction can break or become unsynced with screen position (usually after scrolling the page)
Investigate ways to add slight randomness to the animation physics
*/

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', {willReadFrequently: true});
const fileInput = document.getElementById('fileInput');
const resetButton = document.getElementById('resetButton');
const particleCountDisplay = document.getElementById('particleCount');

let particles;
let particleInitialPositions;
let particleColors;
let width;
let height;
let particleCount;
let mouseX = -1, mouseY = -1;
let mouseRadius = 100;
let repelForce = 4;
let healingFactor = 30;
let animationId;
let currentImage = null;
const canvasMetrics = {};
let frameCounter = 0;
const MIN_DIMENSION = 500;
const MAX_DIMENSION = 1000;

//add gui
var obj = {
  particleDensity: 50,
  effectRadius: 100,
  forceStrength: 4,
  healingFactor: 30,
};

var gui = new dat.gui.GUI( { autoPlace: false } );
gui.close();
var guiOpenToggle = false;

gui.add(obj, "particleDensity").min(10).max(100).step(1).name('Particle Density').onFinishChange(resetCanvas);
gui.add(obj, "effectRadius").min(20).max(400).step(1).name('Effect Radius');
gui.add(obj, "forceStrength").min(1).max(20).step(1).name('Force Strength');
gui.add(obj, "healingFactor").min(1).max(100).step(1).name('Self-Healing Speed');

obj['uploadImage'] = function () {
  fileInput.click();
};
gui.add(obj, 'uploadImage').name('Upload Image');

obj['resetCanvas'] = function () {
  resetCanvas();
};
gui.add(obj, 'resetCanvas').name("Reset Canvas (r)");

obj['saveImage'] = function () {
  saveImage();
};
gui.add(obj, 'saveImage').name("Save Image (s)");

obj['saveVideo'] = function () {
  toggleVideoRecord();
};
gui.add(obj, 'saveVideo').name("Video Export (v)");

customContainer = document.getElementById( 'gui' );
customContainer.appendChild(gui.domElement);


function processImage(image, resetState = true) {
  if (resetState) {
      currentImage = image;
  }

  if (animationId) {
      cancelAnimationFrame(animationId);
  }

  // Resize image if necessary
  const resizedCanvas = resizeImage(image);
  width = canvas.width = resizedCanvas.width;
  height = canvas.height = resizedCanvas.height;
  console.log("Canvas w/h dimensions: "+width+", "+height);

  ctx.drawImage(resizedCanvas, 0, 0);
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = new Uint32Array(imageData.data.buffer);

  particleCount = Math.floor((width * height * obj.particleDensity/100)) * 1.5;
  document.querySelector("#particleCountCell").textContent = "# Particles: "+Number(particleCount).toLocaleString();

  particles = new Float32Array(particleCount * 4);
  particleInitialPositions = new Float32Array(particleCount * 2);
  particleColors = new Uint32Array(particleCount);

  //Place initial particles randomly on the canvas, with color based on source image
  for (let i = 0; i < particleCount; i++) {
      const idx = i * 4;
      const posIdx = i * 2;
      
      const x =  Math.random() * width;
      const y = Math.random() * height;

      particles[idx] = x;
      particles[idx + 1] = y;
      particles[idx + 2] = 0;
      particles[idx + 3] = 0;
      
      particleInitialPositions[posIdx] = x;
      particleInitialPositions[posIdx + 1] = y;

      const pixelX = Math.min(Math.floor(x), width - 1);
      const pixelY = Math.min(Math.floor(y), height - 1);
      const pixelIndex = pixelY * width + pixelX;
      particleColors[i] = pixels[pixelIndex];
  }

  calculateCanvasMetrics();
  animate();
}

//Repulsion forcefield effect with self-healing
function animate() {
  mouseRadius = obj.effectRadius + (Math.sin(frameCounter/10)/2 * obj.effectRadius);
  repelForce = obj.forceStrength;
  healingFactor = obj.healingFactor / 25000;
  
  const radiusSq = mouseRadius * mouseRadius;
  const imageData = ctx.createImageData(width, height);
  const data = new Uint32Array(imageData.data.buffer);

  data.fill(0);

  for (let i = 0; i < particleCount; i++) {
      const idx = i * 4;
      const posIdx = i * 2;

      const px = particles[idx];
      const py = particles[idx + 1];
      const initialX = particleInitialPositions[posIdx];
      const initialY = particleInitialPositions[posIdx + 1];

      if (mouseX >= 0 && mouseY >= 0) {
          const dx = px - mouseX;
          const dy = py - mouseY;
          const distanceSq = dx * dx + dy * dy;

          if (distanceSq < radiusSq && distanceSq > 0) {
              const distance = distanceSq ** 0.5;
              const effectStrength = (1 - distance / mouseRadius) * repelForce;
              particles[idx + 2] += (dx / distance) * effectStrength;
              particles[idx + 3] += (dy / distance) * effectStrength;
          }
      }

      particles[idx + 2] += (initialX - px) * healingFactor;
      particles[idx + 3] += (initialY - py) * healingFactor;

      particles[idx] += particles[idx + 2];
      particles[idx + 1] += particles[idx + 3];

      particles[idx + 2] *= 0.95;
      particles[idx + 3] *= 0.95;

      if (particles[idx] < 0) {
          particles[idx] = 0;
          particles[idx + 2] *= -0.5;
      } else if (particles[idx] >= width) {
          particles[idx] = width - 1;
          particles[idx + 2] *= -0.5;
      }

      if (particles[idx + 1] < 0) {
          particles[idx + 1] = 0;
          particles[idx + 3] *= -0.5;
      } else if (particles[idx + 1] >= height) {
          particles[idx + 1] = height - 1;
          particles[idx + 3] *= -0.5;
      }

      const x = Math.round(particles[idx]);
      const y = Math.round(particles[idx + 1]);
      const pixelIndex = y * width + x;
      data[pixelIndex] = particleColors[i];
  }

  ctx.putImageData(imageData, 0, 0);
  frameCounter++;
  animationId = requestAnimationFrame(animate);
}

//HELPER FUNCTIONS

// Info screen functions
function closeInfoScreen() {
    const infoScreen = document.getElementById('infoScreen');
    infoScreen.style.opacity = '0.0';
    infoScreen.style.transition = 'opacity 0.3s ease-out';
    setTimeout(() => {
        infoScreen.style.display = 'none';
    }, 300);
}

function resetCanvas(){
  if (currentImage) {
    processImage(currentImage);
  }
}

function resizeImage(image) {
    const tempCanvas = document.createElement('canvas');
    
    // Calculate aspect ratio
    const aspectRatio = image.width / image.height;
    
    // Initialize new dimensions
    let newWidth = image.width;
    let newHeight = image.height;
    
    // First, handle minimum dimensions
    if (newWidth < MIN_DIMENSION || newHeight < MIN_DIMENSION) {
        if (aspectRatio > 1) {
            // Image is wider than tall
            if (newHeight < MIN_DIMENSION) {
                newHeight = MIN_DIMENSION;
                newWidth = Math.round(MIN_DIMENSION * aspectRatio);
            }
        } else {
            // Image is taller than wide
            if (newWidth < MIN_DIMENSION) {
                newWidth = MIN_DIMENSION;
                newHeight = Math.round(MIN_DIMENSION / aspectRatio);
            }
        }
    }
    
    // Then, handle maximum dimensions
    if (newWidth > MAX_DIMENSION || newHeight > MAX_DIMENSION) {
        if (aspectRatio > 1) {
            // Image is wider than tall
            if (newWidth > MAX_DIMENSION) {
                newWidth = MAX_DIMENSION;
                newHeight = Math.round(MAX_DIMENSION / aspectRatio);
            }
        } else {
            // Image is taller than wide
            if (newHeight > MAX_DIMENSION) {
                newHeight = MAX_DIMENSION;
                newWidth = Math.round(MAX_DIMENSION * aspectRatio);
            }
        }
    }
    
    // Set canvas dimensions to our calculated values
    tempCanvas.width = newWidth;
    tempCanvas.height = newHeight;
    
    // Draw resized image
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(image, 0, 0, newWidth, newHeight);
    
    console.log(`Original dimensions: ${image.width}x${image.height}`);
    console.log(`Resized dimensions: ${newWidth}x${newHeight}`);
    
    document.querySelector("#canvasSizeCell").textContent = "Width / Height: "+newWidth+" x "+newHeight+" px";

    return tempCanvas;
}

function calculateCanvasMetrics() {
    const rect = canvas.getBoundingClientRect();
    const aspectRatioCanvas = width / height;
    const aspectRatioRect = rect.width / rect.height;

    const isCanvasWider = aspectRatioCanvas > aspectRatioRect;
    const displayedWidth = isCanvasWider ? rect.width : rect.height * aspectRatioCanvas;
    const displayedHeight = isCanvasWider ? rect.width / aspectRatioCanvas : rect.height;

    canvasMetrics.offsetX = (rect.width - displayedWidth) / 2 + rect.left;
    canvasMetrics.offsetY = (rect.height - displayedHeight) / 2 + rect.top;
    canvasMetrics.scaleX = width / displayedWidth;
    canvasMetrics.scaleY = height / displayedHeight;
}

//Functions to handle mouse and mobile touch interactions
function updateMousePosition(e) {
    const { offsetX, offsetY, scaleX, scaleY } = canvasMetrics;
    mouseX = (e.clientX - offsetX) * scaleX;
    mouseY = (e.clientY - offsetY) * scaleY;
}

function updateInteractionPosition(clientX, clientY) {
    const { offsetX, offsetY, scaleX, scaleY } = canvasMetrics;
    mouseX = (clientX - offsetX) * scaleX;
    mouseY = (clientY - offsetY) * scaleY;
}

function handleStart(event) {
    event.preventDefault();
    const touch = event.type === 'touchstart' ? event.touches[0] : event;
    updateInteractionPosition(touch.clientX, touch.clientY);
}

function handleMove(event) {
    event.preventDefault();
    const touch = event.type === 'touchmove' ? event.touches[0] : event;
    updateInteractionPosition(touch.clientX, touch.clientY);
}

function handleEnd(event) {
    event.preventDefault();
    mouseX = -1;
    mouseY = -1;
}

// Event Listeners
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
          const image = new Image();
          image.onload = () => processImage(image);
          image.src = e.target.result;
      };
      reader.readAsDataURL(file);
  }
});

window.addEventListener('resize', calculateCanvasMetrics);

// canvas.addEventListener('mousemove', updateMousePosition);
// canvas.addEventListener('mouseleave', () => {
//     mouseX = -1;
//     mouseY = -1;
// });

// // Remove previous mouse event listeners and add unified interaction handlers
// canvas.removeEventListener('mousemove', updateMousePosition);
// canvas.removeEventListener('mouseleave', () => {
//     mouseX = -1;
//     mouseY = -1;
// });

// Add unified mouse and touch event listeners
canvas.addEventListener('mousedown', handleStart, { passive: false });
canvas.addEventListener('mousemove', handleMove, { passive: false });
canvas.addEventListener('mouseup', handleEnd, { passive: false });
canvas.addEventListener('mouseleave', handleEnd, { passive: false });

// Add touch event listeners
canvas.addEventListener('touchstart', handleStart, { passive: false });
canvas.addEventListener('touchmove', handleMove, { passive: false });
canvas.addEventListener('touchend', handleEnd, { passive: false });
canvas.addEventListener('touchcancel', handleEnd, { passive: false });

function loadDefaultImage() {
    const defaultImage = new Image();
    defaultImage.onload = () => processImage(defaultImage);
    defaultImage.onerror = () => {
        console.error('Error loading default image. Please upload your own image.');
        createFallbackImage();
    };
    
    let random = Math.random()
    if(random<0.33){
      defaultImage.src = 'images/waterRipple.png';
    } else if(random<0.67){
      defaultImage.src = 'images/moons.png';
    } else {
      defaultImage.src = 'images/lavaLamp.png';
    }
}

// Optional fallback function in case the default image fails to load
function createFallbackImage() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 500;  // Default size if no image loads
    tempCanvas.height = 500;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Create a gradient
    const gradient = tempCtx.createLinearGradient(0, 0, 500, 500);
    gradient.addColorStop(0, '#f5c851');
    gradient.addColorStop(0.5, '#63a48e');
    gradient.addColorStop(1, '#0e7395');
    
    tempCtx.fillStyle = gradient;
    tempCtx.fillRect(0, 0, 500, 500);
    
    // Use this as our source image
    processImage(tempCanvas);
}

function toggleGUI(){
  if(guiOpenToggle == false){
      gui.open();
      guiOpenToggle = true;
  } else {
      gui.close();
      guiOpenToggle = false;
  }
}
  
//shortcut hotkey presses
document.addEventListener('keydown', function(event) {
  
  if (event.key === 'r') {
      resetCanvas();
  } else if (event.key === 's') {
      saveImage();
  } else if (event.key === 'v') {
      toggleVideoRecord();
  } else if (event.key === 'o') {
      toggleGUI();
  }
  
});

//SCRIPT STARTUP

// Load default image on startup
loadDefaultImage();