# Ethiopia Immersive Atlas

A standalone, Meta Quest-ready WebXR tourism experience. Serve this folder over HTTPS (or localhost), then use **Enter VR** in Meta Quest Browser.

## Run locally

```powershell
python -m http.server 8080
```

Open `http://localhost:8080`. Desktop controls: drag to look, scroll to move. In a Quest headset, use either Touch controller ray to select a destination; the left stick moves and right stick turns.

## Geographic data

The Ethiopia national and regional outline layers in `assets/` are derived from the public geoBoundaries dataset. Earth color, height, and normal textures are bundled locally so the relief material renders consistently after deployment.

Destination panel photography is sourced from Wikimedia Commons / Wikipedia page-image media, with the Harar image bundled in `assets/harar.jpg`.
