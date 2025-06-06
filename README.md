# LAS Point Cloud AR/VR Viewer

This project demonstrates how to load, parse, and visualize LAS (Lidar LASer) point cloud files in a web browser using A-Frame for AR/VR capabilities and a custom JavaScript LAS parser.

## Features

*   **LAS File Parsing:** Includes a simplified JavaScript LAS parser (`js/las.js`) to read point data (coordinates, color, intensity, classification) from `.las` files.
*   **3D Point Cloud Visualization:** Renders the extracted points as a 3D point cloud using A-Frame and THREE.js.
*   **AR/VR Ready:**
    *   Supports viewing in Virtual Reality (VR) headsets through WebXR.
    *   Supports Augmented Reality (AR) viewing on compatible mobile devices (WebXR with AR module).
*   **Interactive Controls:**
    *   **Desktop:** WASD keys for movement, mouse for looking.
    *   **VR:**
        *   Left controller thumbstick for movement (if `wasd-controls-enabled="true"` on controller).
        *   Right controller thumbstick (up/down) for zooming the point cloud model in/out.
*   **Customizable Appearance:**
    *   Adjust point size.
    *   Option to use point intensity for grayscale coloring if RGB color data is not present in the LAS file.
    *   Center the point cloud automatically.
*   **Dynamic Scaling:** The `ar-scale-adjuster` component helps manage the scale of the point cloud appropriately for desktop, VR, and AR views.
*   **Loading Indicator:** Displays a "Loading..." message while the LAS file is being processed.

## Project Structure

```text
.
├── index.html              # Main HTML file with A-Frame scene
├── ptCloud_subset.las      # Example LAS point cloud file (replace with your own)
├── js/
│   ├── las.js              # LAS file parser
│   ├── pointcloud-component.js # A-Frame component to load and display LAS data
│   └── dem-components.js   # A-Frame components for AR/VR scale adjustment and VR zoom
└── README.md               # This file
```

## Setup and Usage

1.  **Prerequisites:**
    *   A modern web browser with WebXR support (e.g., Chrome, Edge, Firefox, Oculus Browser, Meta Quest Browser).
    *   For AR, a mobile device and browser supporting WebXR AR Module.

2.  **Get the Code:**
    Clone or download this repository/project files.

3.  **Place your LAS file:**
    *   Put your `.las` file (e.g., `my_points.las`) in the root directory of the project, alongside `index.html`.
    *   Update the `src` attribute in the `las-point-cloud` component within `index.html` to point to your file:
        ```html
        <a-entity id="point-cloud-display"
                  las-point-cloud="src: your_file_name.las;
                                   ..."
                  ...>
        </a-entity>
        ```

4.  **Serve Locally:**
    You **must** serve these files from a local web server due to browser security restrictions (CORS) when fetching local files.
    *   **Using Node.js (if installed):**
        Open your terminal in the project's root directory and run:
        ```bash
        npx http-server
        ```
        Then open `http://localhost:8080` (or the address shown) in your browser.
    *   **Using Python (if installed):**
        Open your terminal in the project's root directory.
        For Python 3:
        ```bash
        python -m http.server
        ```
        For Python 2:
        ```bash
        python -m SimpleHTTPServer
        ```
        Then open `http://localhost:8000` in your browser.
    *   **Using VS Code Live Server:**
        If you use Visual Studio Code, install the "Live Server" extension, right-click on `index.html` and select "Open with Live Server".

5.  **View:**
    *   **Desktop:** Open the served URL in your browser. Use WASD to move and mouse to look around.
    *   **VR:** Open the URL in a WebXR-enabled browser on your VR headset. Click the "Enter VR" button.
    *   **AR:** Open the URL on a compatible AR mobile device. Click the "Enter AR" button (if it appears).

## Customization

### `index.html`

*   **LAS File Source:**
    Change `src: ptCloud_subset.las;` in the `<a-entity las-point-cloud="...">` to your LAS file.
*   **Point Size:**
    Modify `pointSize: 0.1;` in `<a-entity las-point-cloud="...">`. Higher values make points bigger.
*   **Max Points to Load:**
    To load all points, ensure the `maxPoints` attribute is removed from `<a-entity las-point-cloud="...">` (it defaults to Infinity). To limit points for performance, add `maxPoints: 500000;` (for example).
*   **Centering:**
    `centerCloud: true;` in `<a-entity las-point-cloud="...">` will automatically center the point cloud. Set to `false` to use original LAS offsets.
*   **Intensity as Grayscale:**
    `useIntensityAsGrayscale: true;` will use intensity values if no RGB color is found.
*   **AR/VR Scaling (`ar-scale-adjuster` on `#ar-vr-world`):**
    *   `arScale`: Overall scale of the scene in AR mode (e.g., `0.1` for 10% size).
    *   `vrScale`: Overall scale of the scene in VR/Desktop mode (e.g., `1` for 100% size).
    *   `arYOffset` / `vrYOffset`: Vertical offset applied in AR/VR.
    *   `defaultPosAR` / `defaultPosVR`: Initial position of the scene content in AR/VR.
*   **Zoom Sensitivity (`vr-dem-zoom` on `#right-controller`):**
    *   `zoomSpeed`: How quickly the scene scales with thumbstick movement.
    *   `minScale` / `maxScale`: Limits for the zoom functionality.

### `js/pointcloud-component.js`

*   **`sizeAttenuation`:** (Advanced) Inside the `createPointCloudMesh` function, you can set `material.sizeAttenuation = false;` to make points maintain a consistent screen-space size regardless of distance. Default is `true`.

### `js/las.js`

This file contains the LAS parser. It's a simplified parser and may not support all LAS features or versions. For more complex needs, a more robust LAS library might be required.

## Known Limitations

*   **Performance:** Rendering very large point clouds (many millions of points) can be demanding on browser performance and memory, especially in VR/AR. The `maxPoints` attribute is provided to help manage this.
*   **LAS Parser Simplicity:** The included `LASParser` is basic and designed for common point data formats. It may not handle all LAS version intricacies, variable length records (VLRs), or extended variable length records (EVLRs) beyond what's needed for basic header info and point data access.
*   **AR Compatibility:** WebXR AR is still evolving. Device and browser support can vary.

## Potential Future Enhancements

*   Level of Detail (LOD) rendering for larger point clouds.
*   More sophisticated point rendering techniques (e.g., splats, shaders for better lighting).
*   Support for more LAS features and attributes.
*   GUI for adjusting parameters.
*   Interaction with individual points (e.g., picking, querying attributes).

## Credits

*   **A-Frame:** [https://aframe.io](https://aframe.io) - Web framework for building virtual reality experiences.
*   **THREE.js:** [https://threejs.org](https://threejs.org) - Underlying 3D library used by A-Frame.
*   LAS Parser ideas inspired by various open-source JavaScript LAS parsers.
