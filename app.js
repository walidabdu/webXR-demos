import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const canvas = document.querySelector('#scene');
const loading = document.querySelector('#loading');
const enterButton = document.querySelector('#enter-vr');
const card = document.querySelector('#place-card');
const cardImage = document.querySelector('#card-image');
const cardRegion = document.querySelector('#card-region');
const cardTitle = document.querySelector('#card-title');
const cardDescription = document.querySelector('#card-description');

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x03050b, 0.017);
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.05, 160);
camera.position.set(0, 1.63, 0);
const playerRig = new THREE.Group();
playerRig.add(camera);
scene.add(playerRig);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

scene.add(new THREE.HemisphereLight(0x779bd1, 0x190a05, 1.4));
const sun = new THREE.DirectionalLight(0xffd28e, 2.4); sun.position.set(-8, 6, 4); scene.add(sun);

const world = new THREE.Group(); scene.add(world);
const textureLoader = new THREE.TextureLoader();
const globeCenter = new THREE.Vector3(0, 1.25, -10.6);
const globeRadius = 4.55;
const selectable = [];
const clock = new THREE.Clock();
let hovered = null;
let activePlace = null;

function makeStars() {
  const count = 1300, positions = new Float32Array(count * 3), colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 34 + Math.random() * 70, theta = Math.random() * Math.PI * 2, phi = Math.acos(2 * Math.random() - 1);
    positions.set([r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi) + 7, r * Math.sin(phi) * Math.sin(theta)], i * 3);
    const v = .45 + Math.random() * .55; colors.set([v, v * .89, v * .72], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(positions, 3)); g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  world.add(new THREE.Points(g, new THREE.PointsMaterial({ size: .07, vertexColors: true, transparent: true, opacity: .8, sizeAttenuation: true })));
}
makeStars();

const earthTexture = textureLoader.load('assets/earth-color.jpg', () => loading.classList.add('done'), undefined, () => loading.classList.add('done'));
const terrainTexture = textureLoader.load('assets/earth-height.jpg');
const normalTexture = textureLoader.load('assets/earth-normal.jpg');
earthTexture.colorSpace = THREE.SRGBColorSpace;
const globeSystem = new THREE.Group(); globeSystem.position.copy(globeCenter); world.add(globeSystem);
const mapRoot = new THREE.Group(); mapRoot.rotation.y = THREE.MathUtils.degToRad(-50.5); globeSystem.add(mapRoot);
const geoLayer = new THREE.Group(); mapRoot.add(geoLayer);
const globe = new THREE.Mesh(new THREE.SphereGeometry(globeRadius, 192, 128), new THREE.MeshStandardMaterial({
  map: earthTexture, normalMap: normalTexture, normalScale: new THREE.Vector2(.7, .7), bumpMap: terrainTexture, bumpScale: .28, displacementMap: terrainTexture, displacementScale: .11, roughness: .66, metalness: .02
}));
// The common map root keeps terrain, political borders, rivers and hotspots in the same geographic frame.
mapRoot.add(globe);
const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(globeRadius * 1.018, 128, 96), new THREE.MeshBasicMaterial({ color: 0x4c9eff, transparent: true, opacity: .12, side: THREE.BackSide, blending: THREE.AdditiveBlending })); mapRoot.add(atmosphere);
const halo = new THREE.Mesh(new THREE.SphereGeometry(globeRadius * 1.075, 96, 72), new THREE.MeshBasicMaterial({ color: 0x2f7fe8, transparent: true, opacity: .045, side: THREE.BackSide, blending: THREE.AdditiveBlending })); mapRoot.add(halo);
const gltfLoader = new GLTFLoader();
gltfLoader.load('assets/earth.glb', ({ scene: earthModel }) => {
  const bounds = new THREE.Box3().setFromObject(earthModel); const size = bounds.getSize(new THREE.Vector3()); const center = bounds.getCenter(new THREE.Vector3());
  const pivot = new THREE.Group(); pivot.add(earthModel); earthModel.position.sub(center); pivot.scale.setScalar((globeRadius * 2) / Math.max(size.x, size.y, size.z));
  earthModel.traverse(node => { if (node.isMesh) { node.castShadow = false; node.receiveShadow = false; } });
  mapRoot.add(pivot); globe.visible = false;
}, undefined, () => {});

const destinations = [
  { id: 'lalibela', name: 'Lalibela', region: 'AMHARA HIGHLANDS', lat: 12.03, lon: 39.04, image: 'classic', crop: '0% 0%', desc: 'Carved from living rock in the 12th century, Lalibela’s sacred churches form one of the world’s most astonishing pilgrim landscapes.' },
  { id: 'aksum', name: 'Aksum', region: 'TIGRAY · NORTHERN ETHIOPIA', lat: 14.12, lon: 38.72, image: 'classic', crop: '100% 0%', desc: 'Obelisks, royal tombs, and ancient inscriptions trace the legacy of the Aksumite Empire—one of Africa’s great early civilizations.' },
  { id: 'simien', name: 'Simien Mountains', region: 'AMHARA · UNESCO BIOSPHERE', lat: 13.24, lon: 38.06, image: 'classic', crop: '0% 100%', desc: 'Sheer escarpments and endless highland light define this extraordinary range, home to the endemic gelada and Ethiopian wolf.' },
  { id: 'gondar', name: 'Fasil Ghebbi', region: 'GONDAR · ROYAL ENCLOSURE', lat: 12.60, lon: 37.47, image: 'classic', crop: '100% 100%', desc: 'A walled royal compound of soaring castles, gardens, and bathhouses reveals the grandeur of Ethiopia’s seventeenth-century emperors.' },
  { id: 'harar', name: 'Harar Jugol', region: 'HARARI · WALLED CITY', lat: 9.31, lon: 42.12, image: 'new', crop: '0% 0%', desc: 'Within Harar’s ancient walls, winding lanes, shrines, and markets hold centuries of Islamic scholarship and living craft traditions.' },
  { id: 'erta-ale', name: 'Erta Ale', region: 'AFAR · DANAKIL DEPRESSION', lat: 13.60, lon: 40.67, image: 'new', crop: '100% 0%', desc: 'A stark volcanic shield in the Danakil Depression, Erta Ale is famed for its immense caldera and enduring lava lake.' },
  { id: 'sof-omar', name: 'Sof Omar', region: 'BALE · OROMIA', lat: 6.91, lon: 40.85, image: 'new', crop: '0% 100%', desc: 'The Web River has shaped an extraordinary underground world here: vast limestone chambers, passages, and shafts of light.' },
  { id: 'addis', name: 'Addis Ababa', region: 'ETHIOPIA’S CAPITAL', lat: 8.98, lon: 38.76, image: 'new', crop: '100% 100%', desc: 'At the foot of Entoto, Addis Ababa brings together a fast-moving capital, deep cultural history, and highland green space.' }
];

function pointOnGlobe(lat, lon, r = globeRadius) {
  const latitude = THREE.MathUtils.degToRad(lat), longitude = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(r * Math.cos(latitude) * Math.cos(longitude), r * Math.sin(latitude), r * Math.cos(latitude) * Math.sin(longitude));
}
function makeLabel(text, normal) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d');
  x.font = '600 31px DM Mono, monospace'; x.fillStyle = '#f8d797'; x.shadowColor = '#000'; x.shadowBlur = 10; x.fillText(text.toUpperCase(), 12, 56);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(.75, .14), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  const tangentUp = new THREE.Vector3(0, 1, 0).projectOnPlane(normal).normalize();
  const tangentRight = new THREE.Vector3().crossVectors(tangentUp, normal).normalize();
  label.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(tangentRight, tangentUp, normal));
  label.visible = false; return label;
}
function addDestination(place, index) {
  const start = pointOnGlobe(place.lat, place.lon, globeRadius + .12);
  const normal = start.clone().normalize();
  const glow = new THREE.Mesh(new THREE.SphereGeometry(.043, 20, 20), new THREE.MeshBasicMaterial({ color: 0xffd373, transparent: true, opacity: .92 })); glow.position.copy(start); geoLayer.add(glow);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.07, .006, 8, 32), new THREE.MeshBasicMaterial({ color: 0xf7bc55, transparent: true, opacity: .8 })); ring.position.copy(start); ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal); geoLayer.add(ring);
  // The hit volume is invisible; the marker itself remains on the terrain surface.
  const hit = new THREE.Mesh(new THREE.SphereGeometry(.11, 16, 16), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })); hit.position.copy(start); hit.userData.place = place; hit.userData.ring = ring; hit.userData.glow = glow; selectable.push(hit); geoLayer.add(hit);
  const label = makeLabel(place.name, normal); label.position.copy(start).addScaledVector(normal, .025); geoLayer.add(label);
  hit.userData.label = label; hit.userData.seed = index * 1.8;
}
destinations.forEach(addDestination);

function addGeoLine(coordinates, color, opacity, lift) {
  const points = coordinates.map(([lon, lat]) => pointOnGlobe(lat, lon, globeRadius + lift));
  if (points.length < 2) return;
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  geoLayer.add(line);
}
function drawGeoJson(data, color, opacity, lift) {
  const rings = [];
  for (const feature of data.features || []) {
    const geometry = feature.geometry || {};
    if (geometry.type === 'Polygon') rings.push(...geometry.coordinates);
    if (geometry.type === 'MultiPolygon') geometry.coordinates.forEach(polygon => rings.push(...polygon));
  }
  rings.forEach(ring => addGeoLine(ring, color, opacity, lift));
}
Promise.all([
  fetch('assets/ethiopia-boundary.geojson').then(r => r.json()),
  fetch('assets/ethiopia-regions.geojson').then(r => r.json())
]).then(([country, regions]) => {
  drawGeoJson(country, 0xffd173, .95, .14);
  drawGeoJson(regions, 0xd9eaff, .38, .135);
}).catch(() => {});
// Major river paths provide a readable hydrology layer at this close viewing distance.
[
  [[37.32,12.03],[37.42,11.55],[37.36,11.03],[36.92,10.55],[36.30,10.06],[35.48,9.86]],
  [[38.76,8.99],[39.14,9.32],[39.78,9.42],[40.37,9.86],[40.90,10.67],[41.16,11.42]],
  [[37.34,7.15],[36.77,6.43],[36.27,5.57],[35.83,4.77]]
].forEach(river => addGeoLine(river, 0x69c7e8, .7, .145));
function addCity(name, lat, lon) {
  const point = pointOnGlobe(lat, lon, globeRadius + .15); const normal = point.clone().normalize();
  const dot = new THREE.Mesh(new THREE.SphereGeometry(.022, 12, 12), new THREE.MeshBasicMaterial({ color: 0xb9dffd })); dot.position.copy(point); geoLayer.add(dot);
  const label = makeLabel(name, normal); label.scale.setScalar(.48); label.position.copy(point).addScaledVector(normal, .018); label.visible = true; geoLayer.add(label);
}
[['Mekelle',13.49,39.47],['Bahir Dar',11.60,37.39],['Dire Dawa',9.60,41.85],['Adama',8.54,39.27],['Hawassa',7.05,38.48],['Jimma',7.67,36.83]].forEach(city => addCity(...city));

const realPhotos = {
  lalibela: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Lalibela%2C_san_giorgio%2C_esterno_24.jpg/1280px-Lalibela%2C_san_giorgio%2C_esterno_24.jpg',
  aksum: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Rome_Stele.jpg/1280px-Rome_Stele.jpg',
  simien: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Semien_Mountains_9.jpg/1280px-Semien_Mountains_9.jpg',
  gondar: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Fasilides_Palace_01.jpg/1280px-Fasilides_Palace_01.jpg',
  harar: 'assets/harar.jpg',
  'erta-ale': 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Erta_Ale.jpg',
  'sof-omar': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/Sof_Omer_Cave%2C_Ethiopia_%2823194314604%29.jpg/1280px-Sof_Omer_Cave%2C_Ethiopia_%2823194314604%29.jpg',
  addis: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Addis_in_night.jpg/1280px-Addis_in_night.jpg'
};
const destinationImages = {};
function getDestinationImage(place) {
  if (destinationImages[place.id]) return destinationImages[place.id];
  const image = new Image(); image.crossOrigin = 'anonymous'; image.src = realPhotos[place.id];
  image.onload = () => { if (activePlace === place) paintVrCard(place); };
  destinationImages[place.id] = image; return image;
}
const vrCanvas = document.createElement('canvas'); vrCanvas.width = 1024; vrCanvas.height = 560; const vrCtx = vrCanvas.getContext('2d');
const vrCard = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 1.8), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(vrCanvas), transparent: true, side: THREE.FrontSide, depthWrite: false }));
vrCard.position.set(1.35, 1.48, -1.5); vrCard.visible = false; playerRig.add(vrCard);
const closeCanvas = document.createElement('canvas'); closeCanvas.width = 128; closeCanvas.height = 128; const closeCtx = closeCanvas.getContext('2d');
closeCtx.fillStyle = '#15191f'; closeCtx.beginPath(); closeCtx.arc(64, 64, 57, 0, Math.PI * 2); closeCtx.fill(); closeCtx.strokeStyle = '#efb857'; closeCtx.lineWidth = 4; closeCtx.stroke(); closeCtx.fillStyle = '#fff3d8'; closeCtx.font = '58px Arial'; closeCtx.textAlign = 'center'; closeCtx.fillText('×', 64, 83);
const vrClose = new THREE.Mesh(new THREE.PlaneGeometry(.27, .27), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(closeCanvas), transparent: true, depthWrite: false }));
vrClose.position.set(2.83, 2.18, -1.48); vrClose.visible = false; vrClose.userData.action = 'close'; selectable.push(vrClose); playerRig.add(vrClose);
function wrapText(ctx, text, x, y, width, lineHeight) { const words = text.split(' '); let line = ''; for (const word of words) { const next = line + word + ' '; if (ctx.measureText(next).width > width && line) { ctx.fillText(line, x, y); line = word + ' '; y += lineHeight; } else line = next; } ctx.fillText(line, x, y); }
function paintVrCard(place) {
  const image = getDestinationImage(place);
  vrCtx.clearRect(0, 0, 1024, 560); vrCtx.fillStyle = 'rgba(4,7,12,.95)'; vrCtx.fillRect(0,0,1024,560); if (image.complete && image.naturalWidth) vrCtx.drawImage(image, 0, 0, image.width, image.height, 0, 0, 360, 560);
  const fade = vrCtx.createLinearGradient(265, 0, 425, 0); fade.addColorStop(0, 'rgba(4,7,12,0)'); fade.addColorStop(1, 'rgba(4,7,12,.95)'); vrCtx.fillStyle = fade; vrCtx.fillRect(220,0,220,560);
  vrCtx.fillStyle = '#efb857'; vrCtx.font = '24px DM Mono, monospace'; vrCtx.fillText(place.region, 410, 110); vrCtx.fillStyle = '#fff4db'; vrCtx.font = 'bold 58px Georgia, serif'; vrCtx.fillText(place.name, 410, 185); vrCtx.fillStyle = '#c8cbd0'; vrCtx.font = '28px Manrope, sans-serif'; wrapText(vrCtx, place.desc, 410, 250, 540, 44); vrCtx.strokeStyle = '#efb857'; vrCtx.globalAlpha = .5; vrCtx.strokeRect(1, 1, 1022, 558); vrCtx.globalAlpha = 1;
  vrCard.material.map.needsUpdate = true;
}
function selectPlace(place) {
  activePlace = place; cardRegion.textContent = place.region; cardTitle.textContent = place.name; cardDescription.textContent = place.desc; cardImage.style.backgroundImage = `url('${realPhotos[place.id]}')`; cardImage.style.backgroundPosition = 'center'; card.classList.add('visible');
  selectable.forEach(hit => { if (hit.userData.label) hit.userData.label.visible = hit.userData.place === place; });
  paintVrCard(place); vrCard.position.set(1.35, 1.48, -1.5); vrCard.rotation.set(0, 0, 0); vrCard.visible = true; vrClose.visible = true;
}
function closePlaceCard() { card.classList.remove('visible'); vrCard.visible = false; vrClose.visible = false; activePlace = null; selectable.forEach(hit => { if (hit.userData.label) hit.userData.label.visible = false; }); }
document.querySelector('#close-card').addEventListener('click', closePlaceCard);

const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
function findHit(ray) { const intersects = raycaster.intersectObjects(selectable, false).filter(item => item.object.visible); return intersects.length ? intersects[0].object : null; }
function activateHit(hit) { if (!hit) return; if (hit.userData.action === 'close') closePlaceCard(); else selectPlace(hit.userData.place); }
function updateHover(hit) { if (hovered === hit) return; if (hovered && hovered.userData.place) { hovered.userData.ring.material.color.set(0xf7bc55); hovered.userData.glow.scale.setScalar(1); if (hovered.userData.place !== activePlace) hovered.userData.label.visible = false; } hovered = hit; canvas.style.cursor = hit ? 'pointer' : 'grab'; if (hit && hit.userData.place) { hit.userData.ring.material.color.set(0xffffff); hit.userData.glow.scale.setScalar(1.55); hit.userData.label.visible = true; } }
canvas.addEventListener('pointermove', (e) => { pointer.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); raycaster.setFromCamera(pointer, camera); updateHover(findHit(raycaster)); });
canvas.addEventListener('click', () => activateHit(hovered));

const controllerFactory = new XRControllerModelFactory(); const handFactory = new XRHandModelFactory();
for (let i = 0; i < 2; i++) {
  const controller = renderer.xr.getController(i); const ray = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -4)]), new THREE.LineBasicMaterial({ color: 0xf6c464 })); ray.name = 'pointer-ray'; controller.add(ray); controller.addEventListener('selectstart', () => { raycaster.setFromXRController(controller); activateHit(findHit(raycaster)); }); playerRig.add(controller);
  const grip = renderer.xr.getControllerGrip(i); grip.add(controllerFactory.createControllerModel(grip)); playerRig.add(grip);
  const hand = renderer.xr.getHand(i); hand.add(handFactory.createHandModel(hand, 'mesh')); playerRig.add(hand);
}

function startVR() {
  if (!navigator.xr) { alert('WebXR is available in Meta Quest Browser. Open this experience there and use Enter VR.'); return; }
  navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', 'layers'] }).then(session => renderer.xr.setSession(session)).catch(() => {});
}
enterButton.addEventListener('click', startVR);
if (!navigator.xr) enterButton.textContent = 'META QUEST VR ↗';

let dragging = false, lastX = 0, lastY = 0, yaw = 0, pitch = 0;
canvas.addEventListener('pointerdown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
addEventListener('pointerup', () => dragging = false); canvas.addEventListener('pointerleave', () => dragging = false);
canvas.addEventListener('pointermove', e => { if (!dragging || renderer.xr.isPresenting) return; yaw -= (e.clientX - lastX) * .004; pitch = THREE.MathUtils.clamp(pitch - (e.clientY - lastY) * .003, -.65, .52); playerRig.rotation.y = yaw; camera.rotation.x = pitch; lastX = e.clientX; lastY = e.clientY; });
addEventListener('wheel', e => { if (renderer.xr.isPresenting) return; const direction = new THREE.Vector3(); camera.getWorldDirection(direction); direction.y = 0; playerRig.position.addScaledVector(direction.normalize(), -e.deltaY * .003); playerRig.position.x = THREE.MathUtils.clamp(playerRig.position.x, -4, 4); playerRig.position.z = THREE.MathUtils.clamp(playerRig.position.z, -3, 4); }, { passive: true });
function doLocomotion(dt) { if (!renderer.xr.isPresenting) return; const session = renderer.xr.getSession(); for (const source of session.inputSources) { const gp = source.gamepad; if (!gp || !source.handedness) continue; const ax = gp.axes; const x = ax.length > 2 ? ax[2] : ax[0], y = ax.length > 3 ? ax[3] : ax[1]; if (source.handedness === 'left') { const forward = new THREE.Vector3(); camera.getWorldDirection(forward); forward.y = 0; forward.normalize(); const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize(); if (Math.abs(y) > .15) playerRig.position.addScaledVector(forward, -y * dt * 2.2); if (Math.abs(x) > .15) playerRig.position.addScaledVector(right, x * dt * 2.2); } if (source.handedness === 'right' && Math.abs(x) > .22) playerRig.rotation.y -= x * dt * 1.7; }
}
function update(time) {
  const t = time * .001, dt = Math.min(clock.getDelta(), .05); doLocomotion(dt);
  atmosphere.material.opacity = .095 + Math.sin(t * .8) * .025;
  selectable.forEach(hit => { const { ring, glow, label, seed } = hit.userData; const pulse = 1 + Math.sin(t * 2.3 + seed) * .16; ring.scale.setScalar(pulse); glow.scale.setScalar((hit === hovered ? 1.55 : 1) * pulse); label.material.opacity = .63 + Math.sin(t * 1.6 + seed) * .2; });
  renderer.render(scene, camera);
}
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
setTimeout(() => loading.classList.add('done'), 3000);
renderer.setAnimationLoop(update);
