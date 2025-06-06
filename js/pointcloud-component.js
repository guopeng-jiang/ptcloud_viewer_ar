/* global AFRAME, THREE, LASParser */

AFRAME.registerComponent('las-point-cloud', {
    schema: {
        src: { type: 'asset', default: '' },
        pointSize: { type: 'number', default: 0.02 },
        maxPoints: { type: 'number', default: Infinity },
        useIntensityAsGrayscale: { type: 'boolean', default: true },
        centerCloud: { type: 'boolean', default: true } // New: Option to center the cloud
    },

    init: function () {
        this.loaderEl = document.getElementById('loader'); // Assuming 'loader' div exists
        this.pointsObject = null;

        if (typeof LASParser === 'undefined') {
            console.error('LASParser library not found. Ensure las.js is included before this script.');
            if (this.loaderEl) this.loaderEl.textContent = 'Error: LASParser library missing.';
            return;
        }

        if (this.data.src) {
            this.loadLAS(this.data.src);
        } else {
            console.warn('LAS Point Cloud: No src provided.');
            if (this.loaderEl) this.loaderEl.textContent = 'LAS source missing.';
        }
    },

    update: function (oldData) {
        const data = this.data;
        if ((oldData.src !== data.src && data.src) ||
            (this.pointsObject && (oldData.pointSize !== data.pointSize || oldData.centerCloud !== data.centerCloud || oldData.useIntensityAsGrayscale !== data.useIntensityAsGrayscale))
        ) {
            this.removePointCloud(); // Clean up old one
            if (data.src) {
                this.loadLAS(data.src);
            }
        } else if (this.pointsObject && oldData.pointSize !== data.pointSize) {
            // Only pointSize changed, update material
            this.pointsObject.material.size = data.pointSize;
        }
    },

    loadLAS: function (srcPath) {
        if (this.loaderEl) {
            this.loaderEl.style.display = 'block';
            this.loaderEl.textContent = 'Loading LAS file...';
        }
        console.log("Fetching LAS:", srcPath);

        fetch(srcPath)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status} for ${srcPath}`);
                }
                return response.arrayBuffer();
            })
            .then(arrayBuffer => {
                console.log("LAS file loaded into ArrayBuffer, size:", arrayBuffer.byteLength);
                const lasParser = new LASParser(arrayBuffer);
                return lasParser.open().then(() => lasParser.getPoints(this.data.maxPoints));
            })
            .then(pointsData => {
                console.log("Points data extracted, count:", pointsData.count);
                if (pointsData.count === 0) {
                    throw new Error("LAS parser returned 0 points.");
                }
                this.createPointCloudMesh(pointsData);
                if (this.loaderEl) this.loaderEl.style.display = 'none';
                this.el.emit('pointcloud-loaded', { pointsObject: this.pointsObject, pointsData: pointsData }, false);
            })
            .catch(error => {
                console.error("Error loading or parsing LAS file:", error);
                if (this.loaderEl) {
                    this.loaderEl.textContent = `Error: ${error.message}. Check console.`;
                    this.loaderEl.style.display = 'block'; // Keep it visible
                }
            });
    },

    createPointCloudMesh: function (pointsData) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(pointsData.position, 3));

        let hasVertexColors = false;
        if (pointsData.hasColor) {
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(pointsData.color, 3));
            hasVertexColors = true;
        } else if (this.data.useIntensityAsGrayscale && pointsData.intensity) {
            const colors = new Float32Array(pointsData.count * 3);
            for (let i = 0; i < pointsData.count; i++) {
                const intensityNormalized = Math.min(pointsData.intensity[i] / 65535.0, 1.0);
                colors[i * 3 + 0] = intensityNormalized;
                colors[i * 3 + 1] = intensityNormalized;
                colors[i * 3 + 2] = intensityNormalized;
            }
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            hasVertexColors = true;
        }
        
        geometry.computeBoundingSphere(); // Important for A-Frame internal culling and raycasting
        if (this.data.centerCloud) {
            geometry.computeBoundingBox(); // Needed for centering
        }

        const material = new THREE.PointsMaterial({
            size: this.data.pointSize,
            vertexColors: hasVertexColors, // Use vertex colors only if available
        });
        if (!hasVertexColors) {
            material.color.set(0x888888); // Default to gray if no vertex colors
        }

        this.pointsObject = new THREE.Points(geometry, material);

        if (this.data.centerCloud && geometry.boundingBox) {
            const center = new THREE.Vector3();
            geometry.boundingBox.getCenter(center);
            this.pointsObject.position.sub(center); // Center the THREE.Points object
            console.log("Point cloud mesh centered by offset:", center.toArray());
        }

        this.el.setObject3D('pointcloud-mesh', this.pointsObject);
        console.log("LAS Point cloud mesh added to A-Frame entity:", this.el.id);
    },

    removePointCloud: function() {
        if (this.pointsObject) {
            this.el.removeObject3D('pointcloud-mesh');
            if (this.pointsObject.geometry) this.pointsObject.geometry.dispose();
            if (this.pointsObject.material) this.pointsObject.material.dispose();
            this.pointsObject = null;
        }
    },

    remove: function () {
        this.removePointCloud();
        if (this.loaderEl) this.loaderEl.style.display = 'none';
    }
});