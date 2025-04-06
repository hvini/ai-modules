let scene, camera, renderer, controls;
let currentLine = null;
let lineCount = 0;
let data = []
let clickablePoints = [];
let hoveredPointIndex = -1;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const lineColors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0x00ffff, 0xff00ff, 0xffa500, 0x800080];
const achievements = new Set();
const visitedDatasets = new Set();
let currentColorIndex = 0;
let optimizedLineColor = 0xff0000;
let mseBefore = 0;
const it = 500;

const gui = new dat.GUI({ autoPlace: false });
let params = {
    slope: 1,
    intercept: 0,
    quadratic: 0,
    tolerance: 0.5,
    dataset: "default",
    calculateMSE: calculateMSE,
    optimize: runOptimization
};

const datasetTips = {
    "default": "This dataset represents a simple linear relationship. Try to fit a straight line to it.",
    "outliers": "This dataset contains outliers. Notice how they affect the line fit.",
    "nonlinear": "This dataset represents a non-linear relationship. Explore how LR can learn non linear patterns.",
};

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, containerWidth() / containerHeight(), 0.1, 1000);
    camera.position.set(0, 3, 5);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerWidth(), containerHeight());
    renderer.setClearColor(0x2a2f36);
    document.getElementById('scene-container').appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);

    visitedDatasets.add(params.dataset);

    loadAchievements();

    addPoints();
    createCurrentLine();
    createAGrid();
    animate();
    initGUI();
    loadDataset();
    showDatasetTip();

    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('mousemove', onMouseMove, false);
    window.addEventListener('click', onMouseClick, false);
}

function loadAchievements() {
    const savedAchievements = localStorage.getItem('achievements');
    if (savedAchievements) {
        const parsedAchievements = JSON.parse(savedAchievements);
        parsedAchievements.forEach(achievement => achievements.add(achievement));
    }
}

function saveAchievements() {
    localStorage.setItem('achievements', JSON.stringify(Array.from(achievements)));
}

function triggerAchievement(title, message) {
    if (achievements.has(title)) return;
    achievements.add(title);

    saveAchievements();

    const popup = document.createElement("div");
    popup.className = "achievement-popup";
    popup.innerHTML = `<strong>${title}</strong><br>${message}`;
    document.body.appendChild(popup);

    setTimeout(() => {
        popup.remove();
    }, 4000);

    if (title === "Outlier Exterminator") {
        quadraticController.domElement.style.pointerEvents = 'auto';
        quadraticController.domElement.style.opacity = 1;
    }
    if (title === "Curve Master") {
        toleranceController.domElement.style.pointerEvents = 'auto';
        toleranceController.domElement.style.opacity = 1;
        gui.add(params, 'optimize');
    }
}

function containerWidth() {
    return document.getElementById('scene-container').clientWidth;
}
function containerHeight() {
    return document.getElementById('scene-container').clientHeight;
}

function initGUI() {
    document.getElementById('gui-container').appendChild(gui.domElement);
    gui.domElement.style.width = '100%';

    gui.add(params, 'dataset', ["default", "outliers", "nonlinear"]).name("Dataset").onChange(loadDataset);
    gui.add(params, 'slope', -5, 5, 0.1).name("Slope").onChange(updateCurrentLine);
    gui.add(params, 'intercept', -5, 5, 0.1).name("Intercept").onChange(updateCurrentLine);
    quadraticController = gui.add(params, 'quadratic', -5, 5, 0.1).name("Quadratic").onChange(updateCurrentLine);
    toleranceController = gui.add(params, 'tolerance', 0.001, 1, 0.001).name("Tolerance");
    gui.add(params, 'calculateMSE').name("Calculate MSE");

    if (!achievements.has("Outlier Exterminator")) {
        quadraticController.domElement.style.pointerEvents = 'none';
        quadraticController.domElement.style.opacity = 0.5;
    }

    if (!achievements.has("Curve Master")) {
        toleranceController.domElement.style.pointerEvents = 'none';
        toleranceController.domElement.style.opacity = 0.5;
        return;
    }

    gui.add(params, 'optimize').name("Optimize");
}

function showDatasetTip() {
    const instruction = document.getElementById('instruction');
    instruction.textContent = datasetTips[params.dataset];
    instruction.style.opacity = 1;
}

function createAGrid() {
    const gridSize = 5;
    const gridDivisions = 10;

    const gridXZ = new THREE.GridHelper(gridSize, gridDivisions, 0xaaaaaa, 0xdddddd);
    gridXZ.rotation.x = 0;
    scene.add(gridXZ);

    const gridXY = new THREE.GridHelper(gridSize, gridDivisions, 0xcccccc, 0xeeeeee);
    gridXY.rotation.x = Math.PI / 2;
    gridXY.position.z = 0;
    scene.add(gridXY);

    const gridYZ = new THREE.GridHelper(gridSize, gridDivisions, 0xcccccc, 0xeeeeee);
    gridYZ.rotation.z = Math.PI / 2;
    gridYZ.position.x = 0;
    scene.add(gridYZ);
}

function onWindowResize() {
    camera.aspect = containerWidth() / containerHeight();
    camera.updateProjectionMatrix();
    renderer.setSize(containerWidth(), containerHeight());
}

function addPoints() {
    for (const mesh of clickablePoints) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
    }
    clickablePoints = [];

    for (let i = 0; i < data.length; i++) {
        const [x, y] = data[i];
        const geometry = new THREE.SphereGeometry(0.1, 16, 16);
        const material = new THREE.MeshBasicMaterial({ color: 0x0000ff });
        const pointMesh = new THREE.Mesh(geometry, material);
        pointMesh.position.set(x, y, 0);
        pointMesh.userData.index = i;
        scene.add(pointMesh);
        clickablePoints.push(pointMesh);
    }
}

function createCurrentLine() {
    if (currentLine) scene.remove(currentLine);
    const material = new THREE.LineBasicMaterial({ color: lineColors[currentColorIndex % lineColors.length], linewidth: 3 });
    const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-2, 0, 0), new THREE.Vector3(2, 0, 0)]);
    currentLine = new THREE.Line(geometry, material);
    scene.add(currentLine);
    updateCurrentLine();
}

function updateCurrentLine() {
    const m = params.slope;
    const b = params.intercept;
    const q = params.quadratic;

    const points = [];
    for (let x = -2; x <= 2; x += 0.1) {
        const y = q * x * x + m * x + b;
        points.push(new THREE.Vector3(x, y, 0));
    }
    currentLine.geometry.setFromPoints(points);
}

function calculateMSE(optimizing = false) {
    const m = params.slope;
    const b = params.intercept;
    const q = params.quadratic;

    let mse = data.reduce((sum, [x, y]) => sum + Math.pow(y - (q * x * x + m * x + b), 2), 0) / data.length;
    showPrompt(`MSE: ${mse.toFixed(6)}`, optimizing);

    if (params.dataset === "default" && mse < 0.1) {
        triggerAchievement("Line Whisperer", "No tools, no tricks — just perfect intuition. You're in sync with the data!");
    }

    if (params.dataset === "outliers") {
        if (mse >= 0.1 && !achievements.has("Outlier Avalanche")) {
            mseBefore = mse;
            triggerAchievement("Outlier Avalanche", "You discovered how outliers can wreck MSE!");
        } else if (mse < mseBefore) {
            triggerAchievement("Outlier Exterminator", "You removed an outlier and improved the fit!");
        }
    }

    if (q != 0 && mse < 0.1 && !optimizing) {
        triggerAchievement("Curve Master", "You used a quadratic term and nailed the perfect fit!");
    }

    return mse;
}

async function runOptimization() {
    let m = params.slope;
    let b = params.intercept;
    let q = params.quadratic;

    const learningRate = 0.01;
    const tolerance = params.tolerance;

    let mse = Infinity;
    let count = 0;

    while (mse > tolerance) {
        if (count > it) break;
        let dm = 0, db = 0, dq = 0;
        for (const [x, y] of data) {
            dm += -(2 / data.length) * x * (y - (q * x * x + m * x + b));
            db += -(2 / data.length) * (y - (q * x * x + m * x + b));
            dq += -(2 / data.length) * x * x * (y - (q * x * x + m * x + b));
        }
        m -= learningRate * dm;
        b -= learningRate * db;
        q -= learningRate * dq;

        params.slope = m;
        params.intercept = b;
        params.quadratic = q;

        updateCurrentLine();

        renderer.render(scene, camera);

        mse = calculateMSE(true);

        count++;

        await new Promise(resolve => setTimeout(resolve, 10));
    }

    if (mse <= 0.1) {
        triggerAchievement("Line Tamer", "You optimized the line to a solid fit!");
    } else {
        triggerAchievement("Tame the Beast", "Adjust the tolerance to improve your model’s performance!");
    }

    const optimizedLine = currentLine.clone();
    optimizedLine.material.color.set(optimizedLineColor);
    scene.add(optimizedLine);
}

function showPrompt(text, optimizing) {
    const instruction = document.getElementById('instruction');
    instruction.textContent = text;
    instruction.style.opacity = 1;
    if (optimizing) return;
    setTimeout(() => {
        instruction.textContent = datasetTips[params.dataset];
    }, 3000);
}

function loadDataset() {
    const datasetName = params.dataset;
    visitedDatasets.add(datasetName);

    if (visitedDatasets.size === 3) {
        triggerAchievement("Exploration Enthusiast", "You tried all dataset types!");
    }

    if (datasetName === "outliers") {
        data = [
            [-1.5, -2], [-1, -1.5], [-0.5, -1], [0, -0.5],
            [0.5, 0], [1, 0.5], [1.5, 1], [2, 1.5], [-1, 1.5], [1.5, -1]
        ];
    } else if (datasetName === "nonlinear") {
        data = [
            [1.5, 1.5], [1.2, 1.2], [0.9, 0.7], [0.5, 0.2], [0, 0],
            [-0.5, 0.2], [-0.9, 0.7], [-1.2, 1.2], [-1.5, 1.5]
        ];
    } else {
        data = [
            [-1.5, -2], [-1, -1.5], [-0.5, -1], [0, -0.5],
            [0.5, 0], [1, 0.5], [1.5, 1], [2, 1.5]
        ];
    }

    addPoints();
    showDatasetTip();
}

function onMouseMove(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(clickablePoints);

    if (intersects.length > 0) {
        document.body.style.cursor = 'pointer';
        hoveredPointIndex = data.findIndex(p =>
            p[0] === intersects[0].object.position.x &&
            p[1] === intersects[0].object.position.y
        );
    } else {
        document.body.style.cursor = 'default';
        hoveredPointIndex = -1;
    }
}

function onMouseClick() {
    if (hoveredPointIndex !== -1) {
        data.splice(hoveredPointIndex, 1);
        addPoints();
        hoveredPointIndex = -1;
    }
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

init();