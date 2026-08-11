import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';

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

const earthTexture = textureLoader.load('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg', () => loading.classList.add('done'), undefined, () => loading.classList.add('done'));
const terrainTexture = textureLoader.load('https://threejs.org/examples/textures/planets/earthbump1k.jpg');
const normalTexture = textureLoader.load('https://threejs.org/examples/textures/planets/earth_normal_2048.jpg');
earthTexture.colorSpace = THREE.SRGBColorSpace;
const globeSystem = new THREE.Group(); globeSystem.position.copy(globeCenter); world.add(globeSystem);
const globe = new THREE.Mesh(new THREE.SphereGeometry(globeRadius, 192, 128), new THREE.MeshStandardMaterial({
  map: earthTexture, normalMap: normalTexture, normalScale: new THREE.Vector2(.58, .58), displacementMap: terrainTexture, displacementScale: .065, roughness: .7, metalness: .03
}));
// The texture is offset so the Ethiopian highlands are at the centre of the visitor's view.
globe.rotation.y = THREE.MathUtils.degToRad(-129.5); globeSystem.add(globe);
const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(globeRadius * 1.018, 128, 96), new THREE.MeshBasicMaterial({ color: 0x4c9eff, transparent: true, opacity: .12, side: THREE.BackSide, blending: THREE.AdditiveBlending })); globeSystem.add(atmosphere);
const halo = new THREE.Mesh(new THREE.SphereGeometry(globeRadius * 1.075, 96, 72), new THREE.MeshBasicMaterial({ color: 0x2f7fe8, transparent: true, opacity: .045, side: THREE.BackSide, blending: THREE.AdditiveBlending })); globeSystem.add(halo);

const destinations = [
  { id: 'lalibela', name: 'Lalibela', region: 'AMHARA HIGHLANDS', lat: 12.03, lon: 39.04, crop: '0% 0%', desc: 'Carved from living rock in the 12th century, Lalibela’s sacred churches form one of the world’s most astonishing pilgrim landscapes.' },
  { id: 'aksum', name: 'Aksum', region: 'TIGRAY · NORTHERN ETHIOPIA', lat: 14.12, lon: 38.72, crop: '100% 0%', desc: 'Obelisks, royal tombs, and ancient inscriptions trace the legacy of the Aksumite Empire—one of Africa’s great early civilizations.' },
  { id: 'simien', name: 'Simien Mountains', region: 'AMHARA · UNESCO BIOSPHERE', lat: 13.24, lon: 38.06, crop: '0% 100%', desc: 'Sheer escarpments and endless highland light define this extraordinary range, home to the endemic gelada and Ethiopian wolf.' },
  { id: 'gondar', name: 'Fasil Ghebbi', region: 'GONDAR · ROYAL ENCLOSURE', lat: 12.60, lon: 37.47, crop: '100% 100%', desc: 'A walled royal compound of soaring castles, gardens, and bathhouses reveals the grandeur of Ethiopia’s seventeenth-century emperors.' }
];

function pointOnGlobe(lat, lon, r = globeRadius) {
  const latitude = THREE.MathUtils.degToRad(lat), longitude = THREE.MathUtils.degToRad(lon - 39.5);
  return new THREE.Vector3(r * Math.cos(latitude) * Math.sin(longitude), r * Math.sin(latitude), r * Math.cos(latitude) * Math.cos(longitude));
}
function makeLabel(text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d');
  x.font = '500 34px DM Mono, monospace'; x.letterSpacing = '3px'; x.fillStyle = '#f8d797'; x.shadowColor = '#000'; x.shadowBlur = 10; x.fillText(text.toUpperCase(), 3, 50);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })); sprite.scale.set(1.38, .26, 1); return sprite;
}
function addDestination(place, index) {
  const start = pointOnGlobe(place.lat, place.lon);
  const normal = start.clone().normalize();
  const end = start.clone().addScaledVector(normal, .72 + index * .08);
  const lineGeometry = new THREE.BufferGeometry().setFromPoints([start, end]);
  const beam = new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: 0xf4bd58, transparent: true, opacity: .82 })); globeSystem.add(beam);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(.043, 20, 20), new THREE.MeshBasicMaterial({ color: 0xffd373, transparent: true, opacity: .92 })); glow.position.copy(end); globeSystem.add(glow);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.07, .006, 8, 32), new THREE.MeshBasicMaterial({ color: 0xf7bc55, transparent: true, opacity: .8 })); ring.position.copy(end); ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal); globeSystem.add(ring);
  // The interaction volume stays comfortable in VR while the visible marker remains precise.
  const hit = new THREE.Mesh(new THREE.SphereGeometry(.11, 16, 16), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })); hit.position.copy(end); hit.userData.place = place; hit.userData.ring = ring; hit.userData.glow = glow; selectable.push(hit); globeSystem.add(hit);
  const labelOffsets = [new THREE.Vector3(-1.15, .63, .10), new THREE.Vector3(1.12, .73, .08), new THREE.Vector3(-1.2, -.62, .16), new THREE.Vector3(1.15, -.78, .12)];
  const label = makeLabel(place.name); label.position.copy(end).add(labelOffsets[index]); label.center.set(index % 2 ? 0 : 1, .5); globeSystem.add(label);
  hit.userData.label = label; hit.userData.seed = index * 1.8;
}
destinations.forEach(addDestination);

const destinationImage = new Image(); destinationImage.src = 'assets/ethiopia-destinations.png';
destinationImage.onload = () => { if (activePlace) paintVrCard(activePlace); };
const vrCanvas = document.createElement('canvas'); vrCanvas.width = 1024; vrCanvas.height = 560; const vrCtx = vrCanvas.getContext('2d');
const vrCard = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 1.8), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(vrCanvas), transparent: true, side: THREE.DoubleSide, depthWrite: false }));
vrCard.position.set(4.6, 2.7, -8.0); vrCard.visible = false; world.add(vrCard);
function wrapText(ctx, text, x, y, width, lineHeight) { const words = text.split(' '); let line = ''; for (const word of words) { const next = line + word + ' '; if (ctx.measureText(next).width > width && line) { ctx.fillText(line, x, y); line = word + ' '; y += lineHeight; } else line = next; } ctx.fillText(line, x, y); }
function paintVrCard(place) {
  const sx = place.crop.startsWith('100') ? destinationImage.width / 2 : 0, sy = place.crop.endsWith('100%') ? destinationImage.height / 2 : 0;
  vrCtx.clearRect(0, 0, 1024, 560); vrCtx.fillStyle = 'rgba(4,7,12,.95)'; vrCtx.fillRect(0,0,1024,560); if (destinationImage.complete) vrCtx.drawImage(destinationImage, sx, sy, destinationImage.width / 2, destinationImage.height / 2, 0, 0, 360, 560);
  const fade = vrCtx.createLinearGradient(265, 0, 425, 0); fade.addColorStop(0, 'rgba(4,7,12,0)'); fade.addColorStop(1, 'rgba(4,7,12,.95)'); vrCtx.fillStyle = fade; vrCtx.fillRect(220,0,220,560);
  vrCtx.fillStyle = '#efb857'; vrCtx.font = '24px DM Mono, monospace'; vrCtx.fillText(place.region, 410, 110); vrCtx.fillStyle = '#fff4db'; vrCtx.font = 'bold 58px Georgia, serif'; vrCtx.fillText(place.name, 410, 185); vrCtx.fillStyle = '#c8cbd0'; vrCtx.font = '28px Manrope, sans-serif'; wrapText(vrCtx, place.desc, 410, 250, 540, 44); vrCtx.strokeStyle = '#efb857'; vrCtx.globalAlpha = .5; vrCtx.strokeRect(1, 1, 1022, 558); vrCtx.globalAlpha = 1;
  vrCard.material.map.needsUpdate = true;
}
function selectPlace(place) {
  activePlace = place; cardRegion.textContent = place.region; cardTitle.textContent = place.name; cardDescription.textContent = place.desc; cardImage.style.backgroundPosition = place.crop; card.classList.add('visible');
  paintVrCard(place); vrCard.visible = true;
}
document.querySelector('#close-card').addEventListener('click', () => { card.classList.remove('visible'); vrCard.visible = false; activePlace = null; });

const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
function findHit(ray) { const intersects = raycaster.intersectObjects(selectable, false); return intersects.length ? intersects[0].object : null; }
function updateHover(hit) { if (hovered === hit) return; if (hovered) { hovered.userData.ring.material.color.set(0xf7bc55); hovered.userData.glow.scale.setScalar(1); } hovered = hit; canvas.style.cursor = hit ? 'pointer' : 'grab'; if (hit) { hit.userData.ring.material.color.set(0xffffff); hit.userData.glow.scale.setScalar(1.55); } }
canvas.addEventListener('pointermove', (e) => { pointer.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); raycaster.setFromCamera(pointer, camera); updateHover(findHit(raycaster)); });
canvas.addEventListener('click', () => { if (hovered) selectPlace(hovered.userData.place); });

const controllerFactory = new XRControllerModelFactory(); const handFactory = new XRHandModelFactory();
for (let i = 0; i < 2; i++) {
  const controller = renderer.xr.getController(i); const ray = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -4)]), new THREE.LineBasicMaterial({ color: 0xf6c464 })); ray.name = 'pointer-ray'; controller.add(ray); controller.addEventListener('selectstart', () => { raycaster.setFromXRController(controller); const hit = findHit(raycaster); if (hit) selectPlace(hit.userData.place); }); scene.add(controller);
  const grip = renderer.xr.getControllerGrip(i); grip.add(controllerFactory.createControllerModel(grip)); scene.add(grip);
  const hand = renderer.xr.getHand(i); hand.add(handFactory.createHandModel(hand, 'mesh')); scene.add(hand);
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
function doLocomotion(dt) { if (!renderer.xr.isPresenting) return; const session = renderer.xr.getSession(); for (const source of session.inputSources) { const gp = source.gamepad; if (!gp || !source.handedness) continue; const ax = gp.axes; const x = ax.length > 2 ? ax[2] : ax[0], y = ax.length > 3 ? ax[3] : ax[1]; if (source.handedness === 'left' && Math.abs(y) > .15) { const forward = new THREE.Vector3(); camera.getWorldDirection(forward); forward.y = 0; playerRig.position.addScaledVector(forward.normalize(), -y * dt * 2.2); } if (source.handedness === 'right' && Math.abs(x) > .22) playerRig.rotation.y -= x * dt * 1.7; }
}
function update(time) {
  const t = time * .001, dt = Math.min(clock.getDelta(), .05); doLocomotion(dt);
  atmosphere.material.opacity = .095 + Math.sin(t * .8) * .025; globeSystem.rotation.y += dt * .004;
  selectable.forEach(hit => { const { ring, glow, label, seed } = hit.userData; const pulse = 1 + Math.sin(t * 2.3 + seed) * .16; ring.scale.setScalar(pulse); glow.scale.setScalar((hit === hovered ? 1.55 : 1) * pulse); label.material.opacity = .63 + Math.sin(t * 1.6 + seed) * .2; });
  if (vrCard.visible) { vrCard.lookAt(camera.getWorldPosition(new THREE.Vector3())); vrCard.rotateY(Math.PI); }
  renderer.render(scene, camera);
}
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
setTimeout(() => loading.classList.add('done'), 3000);
renderer.setAnimationLoop(update);
