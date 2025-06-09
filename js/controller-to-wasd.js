/* global AFRAME */

/**
 * Bridges controller thumbstick/trackpad axismove events to wasd-controls on a target entity,
 * and can optionally handle direct rig rotation.
 */
AFRAME.registerComponent('controller-to-wasd', {
    schema: {
        targetRig: { type: 'selector', default: '#rig' }, // The entity with wasd-controls (or the entity to rotate)

        // Which axes on the controller map to forward/backward and horizontal movement/turning
        fwdAxis: { type: 'number', default: 3 },      // Oculus Touch Left Y-axis for fwd/back
        strafeAxis: { type: 'number', default: 2 },   // Oculus Touch Left X-axis for strafe/turn

        // Behavior of the horizontal axis (strafeAxis)
        horizontalAxisBehavior: { type: 'string', default: 'strafe', oneOf: ['strafe', 'turn'] },
        turnSpeed: { type: 'number', default: 2 }, // Radians per second for turning

        // Invert axes if needed
        invertFwd: { type: 'boolean', default: false },
        invertStrafe: { type: 'boolean', default: false }, // If behavior is 'turn', this inverts turn direction

        deadZone: { type: 'number', default: 0.15 }
    },

    init: function () {
        this.rigElement = null;
        this.wasdControls = null;
        this.axisValues = { x: 0, y: 0 }; // Store processed x (strafe/turn) and y (fwd/back)

        this.updateRigReference();

        this.onAxisMove = this.onAxisMove.bind(this);
        this.el.addEventListener('axismove', this.onAxisMove);

        // Check for specific controller types to adjust default axes if needed
        // Only override if the current values match the schema's original defaults
        const componentSchema = this.schema; // Correct way to access the component's schema
        if (this.el.components['vive-controls']) {
            if (this.data.fwdAxis === componentSchema.fwdAxis.default) { // Use componentSchema here
                this.data.fwdAxis = 1; // Vive trackpad Y
            }
            if (this.data.strafeAxis === componentSchema.strafeAxis.default) { // And here
                this.data.strafeAxis = 0; // Vive trackpad X
            }
            console.log("controller-to-wasd: Vive controller detected, adjusting axis indices if they were defaults.");
        } else if (this.el.components['oculus-touch-controls']) {
             console.log("controller-to-wasd: Oculus Touch controller detected, using default or user-set axis indices.");
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
        }
    },

    setupRig: function(rigEl) {
        this.rigElement = rigEl;
        if (this.rigElement && this.rigElement.components['wasd-controls']) {
            this.wasdControls = this.rigElement.components['wasd-controls'];
            console.log('controller-to-wasd: Successfully linked to wasd-controls on', this.rigElement.id);
        } else if (this.rigElement) {
            console.warn('controller-to-wasd: Could not find wasd-controls component on targetRig:', this.data.targetRig.id,
                         '. Turning behavior will still work if horizontalAxisBehavior is "turn". Movement might not.');
        } else {
            console.error('controller-to-wasd: targetRig resolved to null.');
        }
    },

    onAxisMove: function (evt) {
        if (!evt.detail || !evt.detail.axis) {
            return;
        }

        const axes = evt.detail.axis;
        let rawFwd = 0;
        let rawStrafe = 0; // This will be used for strafe or turn input

        if (axes.length > this.data.fwdAxis) {
            rawFwd = axes[this.data.fwdAxis];
        }
        if (axes.length > this.data.strafeAxis) {
            rawStrafe = axes[this.data.strafeAxis];
        }

        // Apply dead zone
        this.axisValues.y = Math.abs(rawFwd) > this.data.deadZone ? rawFwd : 0;
        let processedHorizontal = Math.abs(rawStrafe) > this.data.deadZone ? rawStrafe : 0;

        // Apply inversion
        if (this.data.invertFwd) this.axisValues.y *= -1;
        if (this.data.invertStrafe) processedHorizontal *= -1; // Applies to strafe or turn

        this.axisValues.x = processedHorizontal;

        // This Y-axis inversion is specific to how wasd-controls interprets analogue forward.
        // Oculus thumbstick forward Y is negative. For wasd-controls, a positive analogue value moves forward.
        this.axisValues.y *= -1;
    },

    tick: function (time, timeDelta) { // time and timeDelta are injected by A-Frame
        if (!this.rigElement) {
            return;
        }

        // Handle forward/backward movement via wasd-controls if available
        let analogueY = this.axisValues.y;
        let analogueX = 0; // Default to no strafe

        if (this.data.horizontalAxisBehavior === 'strafe') {
            analogueX = this.axisValues.x; // Use horizontal axis for strafing
        } else if (this.data.horizontalAxisBehavior === 'turn') {
            // Horizontal axis is for turning, apply rotation directly to the rig
            if (Math.abs(this.axisValues.x) > 0.01) { // Small deadzone for rotation
                // Convert turnSpeed (radians per second) to rotation for this frame
                const deltaRotation = this.axisValues.x * this.data.turnSpeed * (timeDelta / 1000.0);
                // Positive axisValues.x (stick right) should turn character right (clockwise).
                // Clockwise rotation around Y-axis is a negative change in radians.
                this.rigElement.object3D.rotation.y -= deltaRotation;
            }
            // Ensure analogueX remains 0 so wasd-controls doesn't try to strafe
            analogueX = 0;
        }

        // Update wasd-controls for movement (if it exists)
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
        if (this.wasdControls) {
            // Reset analogue controls when component is removed
            this.wasdControls.analogue = { x: 0, y: 0, z: 0 };
        }
        this.rigElement = null;
        this.wasdControls = null;
    }
});