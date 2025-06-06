/* global AFRAME, THREE */

// AR/VR Scale Adjuster (from your template)
AFRAME.registerComponent('ar-scale-adjuster', {
    schema: {
        arScale: { type: 'number', default: 0.05 },
        vrScale: { type: 'number', default: 0.5 },
        arYOffset: { type: 'number', default: 0 },
        vrYOffset: { type: 'number', default: 0 },
        defaultPosVR: { type: 'vec3', default: { x: 0, y: -1, z: -3 } }, // Adjusted default VR pos
        defaultPosAR: { type: 'vec3', default: { x: 0, y: -0.5, z: -1.5 } } // Adjusted default AR pos
    },
    init: function() {
        this.sceneEl = this.el.sceneEl;
        this.currentScale = this.data.vrScale;
        this.checkDelayTimer = null;
        this.isARMode = false;

        this.defaultPositionVR = AFRAME.utils.clone(this.data.defaultPosVR);
        this.defaultPositionAR = AFRAME.utils.clone(this.data.defaultPosAR);
        
        this.onEnterXR = this.onEnterXR.bind(this);
        this.onExitXR = this.onExitXR.bind(this);
        this.checkXRMode = this.checkXRMode.bind(this);

        this.sceneEl.addEventListener('enter-vr', this.onEnterXR);
        this.sceneEl.addEventListener('exit-vr', this.onExitXR);

        // Initial setup for non-XR desktop view
        this.applyTransform(this.data.vrScale, this.defaultPositionVR, false); // Use vrScale for desktop
        this.checkURLParameters();
    },
    onEnterXR: function() {
        // Delay check to allow session to fully establish
        if (this.checkDelayTimer) clearTimeout(this.checkDelayTimer);
        this.checkDelayTimer = setTimeout(this.checkXRMode, 500);
    },
    checkXRMode: function() {
        const renderer = this.sceneEl.renderer;
        const xrManager = renderer.xr;

        if (xrManager && xrManager.isPresenting) {
            const session = xrManager.getSession();
            if (session) {
                this.isARMode = this.detectARMode(session);
                if (this.isARMode) {
                    document.body.classList.add('ar-mode');
                    document.body.classList.remove('vr-mode');
                    this.applyTransform(this.data.arScale, this.defaultPositionAR, true);
                } else {
                    document.body.classList.add('vr-mode');
                    document.body.classList.remove('ar-mode');
                    this.applyTransform(this.data.vrScale, this.defaultPositionVR, false);
                }
            } else { // Fallback if session details are not immediately available
                 this.isARMode = false; // Assume VR
                 document.body.classList.add('vr-mode');
                 document.body.classList.remove('ar-mode');
                 this.applyTransform(this.data.vrScale, this.defaultPositionVR, false);
            }
        } else { // Not presenting (should be covered by onExitXR)
            this.isARMode = false;
            this.applyTransform(this.data.vrScale, this.defaultPositionVR, false);
        }
    },
    detectARMode: function(session) {
        if (session.environmentBlendMode === 'additive' || session.environmentBlendMode === 'alpha-blend') {
            return true;
        }
        if (session.enabledFeatures) {
            const arFeatures = ['hit-test', 'plane-detection', 'anchors', 'camera-access', 'dom-overlay'];
            return arFeatures.some(feature => session.enabledFeatures.includes(feature)) && session.immersive !== true;
        }
        return false;
    },
    checkURLParameters: function() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('ar') === 'true' || urlParams.get('passthrough') === 'true') {
            // This might be called before XR session, so it sets an initial AR-like state.
            // The onEnterXR -> checkXRMode will confirm the actual session type.
            this.isARMode = true;
            this.applyTransform(this.data.arScale, this.defaultPositionAR, true);
            document.body.classList.add('ar-mode', 'url-forced-ar');
        }
    },
    onExitXR: function() {
        if (this.checkDelayTimer) {
            clearTimeout(this.checkDelayTimer);
            this.checkDelayTimer = null;
        }
        this.isARMode = false;
        this.applyTransform(this.data.vrScale, this.defaultPositionVR, false); // Revert to VR scale for desktop
        document.body.classList.remove('ar-mode', 'vr-mode', 'url-forced-ar');
    },
    applyTransform: function(scale, basePosition, isAR) {
        const yOffset = isAR ? this.data.arYOffset : this.data.vrYOffset;
        this.el.setAttribute('scale', `${scale} ${scale} ${scale}`);
        this.el.setAttribute('position', { x: basePosition.x, y: basePosition.y + yOffset, z: basePosition.z });
        this.currentScale = scale; // Store current scale for zoom component
        console.log(`Applied transform: Mode=${isAR ? 'AR' : 'VR'}, Scale=${scale}, Position=`, this.el.getAttribute('position'));
    },
    remove: function() {
        if (this.checkDelayTimer) clearTimeout(this.checkDelayTimer);
        this.sceneEl.removeEventListener('enter-vr', this.onEnterXR);
        this.sceneEl.removeEventListener('exit-vr', this.onExitXR);
        document.body.classList.remove('ar-mode', 'vr-mode', 'url-forced-ar');
    }
});

// VR DEM Zoom Component (from your template)
AFRAME.registerComponent('vr-dem-zoom', {
    schema: {
        targetEl: { type: 'selector' }, // Entity to scale (ar-scale-adjuster-wrapper)
        zoomSpeed: { type: 'number', default: 0.05 },
        minScale: { type: 'number', default: 0.001 }, // Allow smaller scales for AR
        maxScale: { type: 'number', default: 10.0 },  // Allow larger scales
        inputEvents: { type: 'array', default: ['thumbstickmoved', 'axismove'] }
    },

    init: function () {
        this.targetEntity = null;
        this.isVR = false;
        this.eventHandlers = {};
        this.initialTargetScale = new THREE.Vector3(1,1,1); // Store initial scale of target

        // Debounce for targetEl resolution
        const checkTarget = () => {
            if (this.data.targetEl) {
                this.targetEntity = this.data.targetEl;
                if (this.targetEntity && this.targetEntity.object3D) {
                   this.initialTargetScale.copy(this.targetEntity.object3D.scale);
                }
                 console.log("VR DEM Zoom: Target entity found:", this.targetEntity ? this.targetEntity.id : 'null');
            } else {
                console.warn("VR DEM Zoom: Target entity selector is null or invalid.");
            }
        };

        if (this.data.targetEl && this.data.targetEl.hasLoaded) {
            checkTarget();
        } else if (this.data.targetEl) {
            this.data.targetEl.addEventListener('loaded', checkTarget, { once: true });
        } else {
             this.el.sceneEl.addEventListener('loaded', checkTarget, { once: true }); // Fallback if targetEl itself is null
        }


        this.onEnterVR = () => { this.isVR = true; };
        this.onExitVR = () => { this.isVR = false; };

        this.el.sceneEl.addEventListener('enter-vr', this.onEnterVR);
        this.el.sceneEl.addEventListener('exit-vr', this.onExitVR);

        this.data.inputEvents.forEach(eventName => {
            const handler = this.handleControllerInput.bind(this);
            this.eventHandlers[eventName] = handler;
            this.el.addEventListener(eventName, handler);
        });
    },

    handleControllerInput: function (evt) {
        if (!this.isVR || !this.targetEntity || !this.targetEntity.components['ar-scale-adjuster']) return;

        let stickY = 0;
        if (evt.type === 'thumbstickmoved' && evt.detail) {
            stickY = evt.detail.y || 0;
        } else if (evt.type === 'axismove' && evt.detail && evt.detail.axis) {
            // Oculus right thumbstick Y is typically axis[3] (negative for forward).
            // Vive right trackpad Y can be axis[1] (after mapping).
            // Using more robust check for oculus-touch-controls or vive-controls
            const controllerComponent = this.el.components['oculus-touch-controls'] || this.el.components['vive-controls'];
            if (controllerComponent && controllerComponent.data.hand === 'right') {
                 if (evt.detail.axis.length > 2 && this.el.components['oculus-touch-controls']) stickY = evt.detail.axis[3]; // Oculus right stick Y (index 2 for X, 3 for Y)
                 else if (evt.detail.axis.length > 1 && this.el.components['vive-controls']) stickY = evt.detail.axis[1]; // Vive right trackpad Y
                 else if (evt.detail.axis.length > 1) stickY = evt.detail.axis[1]; // Generic fallback for second axis
            }
        }

        if (Math.abs(stickY) > 0.1) { // Deadzone
            const scaleFactor = 1 - (stickY * this.data.zoomSpeed);
            this.updateScale(scaleFactor);
        }
    },

    updateScale: function (factor) {
        if (!this.targetEntity || !this.targetEntity.components['ar-scale-adjuster']) {
            console.warn("VR DEM Zoom: Target entity or ar-scale-adjuster component not found.");
            return;
        }
        // The ar-scale-adjuster component manages the actual scale based on AR/VR mode.
        // We need to adjust its base scale parameters (arScale, vrScale) or its current applied scale.
        // It's simpler to modify the current scale of the target entity directly.
        
        const currentScale = this.targetEntity.object3D.scale.x; // Assuming uniform scale
        let newScaleVal = currentScale * factor;
        newScaleVal = Math.min(Math.max(newScaleVal, this.data.minScale), this.data.maxScale);
        
        this.targetEntity.setAttribute('scale', { x: newScaleVal, y: newScaleVal, z: newScaleVal });
        
        // Update the ar-scale-adjuster's internal reference if it's driving scale
        const adjuster = this.targetEntity.components['ar-scale-adjuster'];
        if (adjuster.isARMode) {
            adjuster.data.arScale = newScaleVal; // This won't trigger re-apply unless schema changes
        } else {
            adjuster.data.vrScale = newScaleVal; // This won't trigger re-apply
        }
        adjuster.currentScale = newScaleVal; // More direct update for zoom
    },

    remove: function () {
        if (this.onEnterVR) this.el.sceneEl.removeEventListener('enter-vr', this.onEnterVR);
        if (this.onExitVR) this.el.sceneEl.removeEventListener('exit-vr', this.onExitVR);
        this.data.inputEvents.forEach(eventName => {
            if (this.eventHandlers[eventName]) {
                this.el.removeEventListener(eventName, this.eventHandlers[eventName]);
            }
        });
    }
});