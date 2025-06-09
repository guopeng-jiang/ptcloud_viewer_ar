/* global AFRAME */

/**
 * Bridges controller thumbstick/trackpad axismove events to wasd-controls for movement,
 * and handles rig rotation either via thumbstick axis or controller buttons.
 */
AFRAME.registerComponent('controller-to-wasd', {
    schema: {
        targetRig: { type: 'selector', default: '#rig' },

        // --- Thumbstick Axis Configuration ---
        fwdAxis: { type: 'number', default: 3 },      // Oculus Touch Left/Right Y-axis for fwd/back
        strafeAxis: { type: 'number', default: 2 },   // Oculus Touch Left/Right X-axis for strafe/axis-turn
        horizontalAxisBehavior: { type: 'string', default: 'strafe', oneOf: ['strafe', 'turn', 'none'] }, // 'none' if buttons handle all turning
        invertFwd: { type: 'boolean', default: false },
        invertStrafe: { type: 'boolean', default: false }, // Inverts strafe or axis-based turn
        deadZone: { type: 'number', default: 0.15 },

        // --- Rotation Control Configuration ---
        rotationControlType: { type: 'string', default: 'axis', oneOf: ['axis', 'buttons', 'none'] },
        turnSpeed: { type: 'number', default: 2 }, // Radians per second for turning (applies to both axis and button turning)

        // --- Button Rotation Configuration (if rotationControlType is 'buttons') ---
        // Note: Component should be on the controller providing these buttons (e.g., right controller for A/B)
        rotateRightButton: { type: 'string', default: 'abuttondown' }, // e.g., 'abuttondown' (Oculus A, Index A)
        rotateLeftButton: { type: 'string', default: 'bbuttondown' },  // e.g., 'bbuttondown' (Oculus B, Index B)
                                                                      // Corresponding 'up' events will be derived
    },

    init: function () {
        this.rigElement = null;
        this.wasdControls = null;
        this.axisValues = { x: 0, y: 0 }; // Processed x (strafe/axis-turn), y (fwd/back)

        this.isPressingRotateLeft = false;
        this.isPressingRotateRight = false;

        // Bind event handlers
        this.onAxisMove = this.onAxisMove.bind(this);
        this.onRotateLeftButtonDown = this.onRotateLeftButtonDown.bind(this);
        this.onRotateLeftButtonUp = this.onRotateLeftButtonUp.bind(this);
        this.onRotateRightButtonDown = this.onRotateRightButtonDown.bind(this);
        this.onRotateRightButtonUp = this.onRotateRightButtonUp.bind(this);

        this.updateRigReference();
        this.el.addEventListener('axismove', this.onAxisMove);

        this.setupControllerSpecificDefaults();
        this.updateButtonListeners();
    },

    update: function(oldData) {
        if (oldData.rotationControlType !== this.data.rotationControlType ||
            oldData.rotateLeftButton !== this.data.rotateLeftButton ||
            oldData.rotateRightButton !== this.data.rotateRightButton) {
            this.updateButtonListeners();
        }
        if (oldData.targetRig !== this.data.targetRig) {
            this.updateRigReference();
        }
        // Other schema changes like turnSpeed, deadZone, etc., will be picked up automatically.
    },

    setupControllerSpecificDefaults: function() {
        const componentSchema = this.schema;
        const el = this.el;
        let controllerType = "";

        if (el.components['oculus-touch-controls']) controllerType = 'oculus-touch';
        else if (el.components['vive-controls']) controllerType = 'vive';
        else if (el.components['valve-index-controls']) controllerType = 'valve-index';
        // Add more controller types if needed (e.g., 'daydream-controls', 'windows-motion-controls')

        // Adjust AXIS defaults if they haven't been changed by the user
        if (controllerType === 'vive') {
            if (this.data.fwdAxis === componentSchema.fwdAxis.default) this.data.fwdAxis = 1;
            if (this.data.strafeAxis === componentSchema.strafeAxis.default) this.data.strafeAxis = 0;
            console.log("controller-to-wasd: Vive controller detected, adjusting axis indices if defaults were used.");
        }
        // For Oculus/Index, the default axis indices (3 for Y, 2 for X) are usually correct for one of the sticks.

        // Adjust BUTTON defaults if they haven't been changed by user & controller is suitable
        // These defaults assume the component is on the RIGHT controller for A/B buttons.
        // A-Frame typically maps Oculus A/B and Index A/B to 'abuttondown' and 'bbuttondown'.
        if (controllerType === 'oculus-touch' || controllerType === 'valve-index') {
            if (this.data.rotateRightButton === componentSchema.rotateRightButton.default) {
                // 'abuttondown' is already the default, good.
            }
            if (this.data.rotateLeftButton === componentSchema.rotateLeftButton.default) {
                // 'bbuttondown' is already the default, good.
            }
             console.log(`controller-to-wasd: ${controllerType} detected. Default A/B buttons for rotation should work.`);
        }
    },

    updateRigReference: function() {
        if (this.data.targetRig) {
            if (this.data.targetRig.hasLoaded) {
                this.setupRig(this.data.targetRig);
            } else {
                this.data.targetRig.addEventListener('loaded', () => {
                    this.setupRig(this.data.targetRig);
                }, { once: true });
            }
        } else {
            console.error('controller-to-wasd: targetRig selector is null.');
            this.rigElement = null;
            this.wasdControls = null;
        }
    },

    setupRig: function(rigEl) {
        this.rigElement = rigEl;
        if (this.rigElement && this.rigElement.components['wasd-controls']) {
            this.wasdControls = this.rigElement.components['wasd-controls'];
            console.log('controller-to-wasd: Successfully linked to wasd-controls on', this.rigElement.id);
        } else if (this.rigElement) {
            console.warn('controller-to-wasd: Could not find wasd-controls component on targetRig:', this.data.targetRig.id,
                         '. Forward/strafe movement via thumbstick might not work. Rotation will still attempt to work.');
            this.wasdControls = null;
        } else {
            console.error('controller-to-wasd: targetRig resolved to null after load.');
            this.rigElement = null;
            this.wasdControls = null;
        }
    },

    updateButtonListeners: function() {
        // Remove existing listeners first
        this.el.removeEventListener(this.data.rotateLeftButton, this.onRotateLeftButtonDown);
        this.el.removeEventListener(this.data.rotateLeftButton.replace('down', 'up'), this.onRotateLeftButtonUp);
        this.el.removeEventListener(this.data.rotateRightButton, this.onRotateRightButtonDown);
        this.el.removeEventListener(this.data.rotateRightButton.replace('down', 'up'), this.onRotateRightButtonUp);

        if (this.data.rotationControlType === 'buttons') {
            this.el.addEventListener(this.data.rotateLeftButton, this.onRotateLeftButtonDown);
            this.el.addEventListener(this.data.rotateLeftButton.replace('down', 'up'), this.onRotateLeftButtonUp);
            this.el.addEventListener(this.data.rotateRightButton, this.onRotateRightButtonDown);
            this.el.addEventListener(this.data.rotateRightButton.replace('down', 'up'), this.onRotateRightButtonUp);
            console.log("controller-to-wasd: Button rotation listeners added for", this.data.rotateLeftButton, "and", this.data.rotateRightButton);
        }
    },

    onRotateLeftButtonDown: function() { this.isPressingRotateLeft = true; },
    onRotateLeftButtonUp: function() { this.isPressingRotateLeft = false; },
    onRotateRightButtonDown: function() { this.isPressingRotateRight = true; },
    onRotateRightButtonUp: function() { this.isPressingRotateRight = false; },

    onAxisMove: function (evt) {
        // console.log('[controller-to-wasd] axismove event on el:', this.el.id, 'Raw axes:', JSON.stringify(evt.detail.axis));
        if (!evt.detail || !evt.detail.axis) {
            return;
        }

        const axes = evt.detail.axis;
        let rawFwd = 0;
        let rawStrafeOrTurn = 0;

        if (axes.length > this.data.fwdAxis) {
            rawFwd = axes[this.data.fwdAxis];
        }
        if (axes.length > this.data.strafeAxis) {
            rawStrafeOrTurn = axes[this.data.strafeAxis];
        }

        this.axisValues.y = Math.abs(rawFwd) > this.data.deadZone ? rawFwd : 0;
        let processedHorizontal = Math.abs(rawStrafeOrTurn) > this.data.deadZone ? rawStrafeOrTurn : 0;

        if (this.data.invertFwd) this.axisValues.y *= -1;
        if (this.data.invertStrafe) processedHorizontal *= -1; // Applies to strafe or axis-based turn

        this.axisValues.x = processedHorizontal;
        this.axisValues.y *= -1; // Standard inversion for wasd-controls forward
    },

    tick: function (time, timeDelta) {
        if (!this.rigElement) { return; }

        const dt = timeDelta / 1000.0; // delta time in seconds
        let rotationThisFrame = 0;

        // --- Handle Rotation ---
        if (this.data.rotationControlType === 'buttons') {
            if (this.isPressingRotateLeft) {
                rotationThisFrame += this.data.turnSpeed * dt; // Positive for left turn (counter-clockwise)
            }
            if (this.isPressingRotateRight) {
                rotationThisFrame -= this.data.turnSpeed * dt; // Negative for right turn (clockwise)
            }
        } else if (this.data.rotationControlType === 'axis' && this.data.horizontalAxisBehavior === 'turn') {
            if (Math.abs(this.axisValues.x) > 0.01) { // Small deadzone already applied in onAxisMove
                // this.axisValues.x is positive for right stick, negative for left stick
                // To make right stick turn right (clockwise = negative rotation), and left stick turn left (counter-clockwise = positive)
                rotationThisFrame -= this.axisValues.x * this.data.turnSpeed * dt;
            }
        }

        if (rotationThisFrame !== 0) {
            this.rigElement.object3D.rotation.y += rotationThisFrame;
        }

        // --- Handle Movement (via wasd-controls if present) ---
        let analogueY = this.axisValues.y; // Forward/backward from thumbstick
        let analogueX = 0; // Strafe

        // Only use thumbstick horizontal for strafe if not used for axis turning OR if buttons are primary for turning
        if (this.data.horizontalAxisBehavior === 'strafe') {
            analogueX = this.axisValues.x;
        }

        if (this.wasdControls) {
            this.wasdControls.analogue = {
                x: analogueX,
                y: analogueY,
                z: 0
            };
        }
    },

    remove: function () {
        this.el.removeEventListener('axismove', this.onAxisMove);
        // Remove button listeners
        this.el.removeEventListener(this.data.rotateLeftButton, this.onRotateLeftButtonDown);
        this.el.removeEventListener(this.data.rotateLeftButton.replace('down', 'up'), this.onRotateLeftButtonUp);
        this.el.removeEventListener(this.data.rotateRightButton, this.onRotateRightButtonDown);
        this.el.removeEventListener(this.data.rotateRightButton.replace('down', 'up'), this.onRotateRightButtonUp);

        if (this.wasdControls) {
            this.wasdControls.analogue = { x: 0, y: 0, z: 0 };
        }
        this.rigElement = null;
        this.wasdControls = null;
    }
});