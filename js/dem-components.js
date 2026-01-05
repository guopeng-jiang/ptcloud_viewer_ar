/* global AFRAME, THREE */

// =====================================
// AR/VR Scale Adjuster
// =====================================
AFRAME.registerComponent('ar-scale-adjuster', {
    schema: {
        arScale: { type: 'number', default: 0.05 },
        vrScale: { type: 'number', default: 0.5 },
        arYOffset: { type: 'number', default: 0 },
        vrYOffset: { type: 'number', default: 0 },
        defaultPosVR: { type: 'vec3', default: { x: 0, y: -1, z: -3 } },
        defaultPosAR: { type: 'vec3', default: { x: 0, y: -0.5, z: -1.5 } }
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
        this.applyTransform(this.data.vrScale, this.defaultPositionVR, false); 
        this.checkURLParameters();
    },
    onEnterXR: function() {
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
            } else { 
                 this.isARMode = false; 
                 document.body.classList.add('vr-mode');
                 document.body.classList.remove('ar-mode');
                 this.applyTransform(this.data.vrScale, this.defaultPositionVR, false);
            }
        } else { 
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
        this.applyTransform(this.data.vrScale, this.defaultPositionVR, false);
        document.body.classList.remove('ar-mode', 'vr-mode', 'url-forced-ar');
    },
    applyTransform: function(scale, basePosition, isAR) {
        const yOffset = isAR ? this.data.arYOffset : this.data.vrYOffset;
        this.el.setAttribute('scale', `${scale} ${scale} ${scale}`);
        this.el.setAttribute('position', { x: basePosition.x, y: basePosition.y + yOffset, z: basePosition.z });
    },
    remove: function() {
        if (this.checkDelayTimer) clearTimeout(this.checkDelayTimer);
        this.sceneEl.removeEventListener('enter-vr', this.onEnterXR);
        this.sceneEl.removeEventListener('exit-vr', this.onExitXR);
        document.body.classList.remove('ar-mode', 'vr-mode', 'url-forced-ar');
    }
});

// =====================================
// VR DEM Zoom Component (Simplified from Source)
// =====================================
AFRAME.registerComponent('vr-dem-zoom', {
    schema: {
        targetEl: { type: 'selector', default: '#ar-vr-world' }, // Matches ID in your Point Cloud HTML
        speed: { type: 'number', default: 1.0 }, 
        minScale: { type: 'number', default: 0.005 },
        maxScale: { type: 'number', default: 5.0 }
    },

    init: function () {
        this.zoomDirection = 0; 
        this.targetEntity = this.data.targetEl;
        this.onThumbstickMoved = this.onThumbstickMoved.bind(this);
        this.onEnterVR = () => { this.isVR = true; };
        this.onExitVR = () => { this.isVR = false; };

        this.el.addEventListener('thumbstickmoved', this.onThumbstickMoved);
        this.el.sceneEl.addEventListener('enter-vr', this.onEnterVR);
        this.el.sceneEl.addEventListener('exit-vr', this.onExitVR);
    },

    onThumbstickMoved: function(evt) {
        const y = evt.detail.y;
        // Simple deadzone check
        if (Math.abs(y) > 0.1) {
            this.zoomDirection = y; 
        } else {
            this.zoomDirection = 0;
        }
    },

    tick: function (time, timeDelta) {
        if (!this.isVR || !this.targetEntity || this.zoomDirection === 0) return;
        
        // Calculate smooth scale factor
        const s = this.data.speed * (timeDelta / 1000); 
        const scaleFactor = 1 - (this.zoomDirection * s);
        
        const currentScale = this.targetEntity.object3D.scale;
        let newS = currentScale.x * scaleFactor;
        
        // Clamp scale
        newS = Math.min(Math.max(newS, this.data.minScale), this.data.maxScale);
        
        this.targetEntity.setAttribute('scale', { x: newS, y: newS, z: newS });
    },

    remove: function () {
        this.el.removeEventListener('thumbstickmoved', this.onThumbstickMoved);
        this.el.sceneEl.removeEventListener('enter-vr', this.onEnterVR);
        this.el.sceneEl.removeEventListener('exit-vr', this.onExitVR);
    }
});