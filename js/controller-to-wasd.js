/* global AFRAME */

/**
 * Bridges controller thumbstick/trackpad axismove events to wasd-controls on a target entity.
 */
AFRAME.registerComponent('controller-to-wasd', {
    schema: {
        targetRig: { type: 'selector', default: '#rig' }, // The entity with wasd-controls
        
        // Which axes on the controller map to forward/backward and left/right
        // These are indices into the event.detail.axis array.
        // For Oculus Touch:
        // - Thumbstick X (left/right): usually axis 2
        // - Thumbstick Y (forward/backward): usually axis 3
        // For Vive Trackpad (after mapping by vive-controls):
        // - Trackpad X: usually axis 0
        // - Trackpad Y: usually axis 1
        // Defaulting to Oculus Touch mapping for left controller.
        // Forward/Backward movement (typically thumbstick Y-axis)
        fwdAxis: { type: 'number', default: 3 }, // Oculus Touch Left Y-axis for fwd/back
        // Strafe Left/Right movement (typically thumbstick X-axis)
        strafeAxis: { type: 'number', default: 2 }, // Oculus Touch Left X-axis for strafe

        // Invert axes if needed
        invertFwd: { type: 'boolean', default: false }, // Set to true if pushing stick fwd moves you backward
        invertStrafe: { type: 'boolean', default: false },// Set to true if pushing stick right moves you left

        deadZone: { type: 'number', default: 0.15 } // Ignore small movements
    },

    init: function () {
        this.rigElement = null;
        this.wasdControls = null;
        this.axisValues = { x: 0, y: 0 }; // Store processed x (strafe) and y (fwd/back)

        this.updateRigReference();

        this.onAxisMove = this.onAxisMove.bind(this);
        this.el.addEventListener('axismove', this.onAxisMove);

        // Check for specific controller types to adjust default axes if needed
        // This is a basic example; more robust detection might be needed for all controllers
        if (this.el.components['vive-controls']) {
            if (this.data.fwdAxis === 3) this.data.fwdAxis = 1; // Vive trackpad Y
            if (this.data.strafeAxis === 2) this.data.strafeAxis = 0; // Vive trackpad X
            console.log("controller-to-wasd: Vive controller detected, adjusting axis indices.");
        } else if (this.el.components['oculus-touch-controls']) {
             console.log("controller-to-wasd: Oculus Touch controller detected, using default axis indices.");
        }
        // Add more else if for other controller types (valve-index-controls, etc.) if their axis mapping differs
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
        }
    },

    setupRig: function(rigEl) {
        this.rigElement = rigEl;
        if (this.rigElement && this.rigElement.components['wasd-controls']) {
            this.wasdControls = this.rigElement.components['wasd-controls'];
            console.log('controller-to-wasd: Successfully linked to wasd-controls on', this.rigElement.id);
        } else {
            console.error('controller-to-wasd: Could not find wasd-controls component on targetRig:', this.data.targetRig);
            this.rigElement = null; // Invalidate if not found
        }
    },

    onAxisMove: function (evt) {
        if (!this.wasdControls || !evt.detail || !evt.detail.axis) {
            return;
        }

        const axes = evt.detail.axis;
        let rawFwd = 0;
        let rawStrafe = 0;

        if (axes.length > this.data.fwdAxis) {
            rawFwd = axes[this.data.fwdAxis];
        }
        if (axes.length > this.data.strafeAxis) {
            rawStrafe = axes[this.data.strafeAxis];
        }
        
        // Apply dead zone
        this.axisValues.y = Math.abs(rawFwd) > this.data.deadZone ? rawFwd : 0;
        this.axisValues.x = Math.abs(rawStrafe) > this.data.deadZone ? rawStrafe : 0;

        // Apply inversion
        if (this.data.invertFwd) this.axisValues.y *= -1;
        if (this.data.invertStrafe) this.axisValues.x *= -1;

        // Oculus thumbstick forward is often negative Y. WASD keys expect:
        // W (forward) -> positive value for the "analogue" forward.
        // S (backward) -> negative value.
        // So, we might need to invert the Y-axis value from the controller.
        // If pushing stick forward is negative, and WASD needs positive for forward, then no change here.
        // Let's assume wasd-controls handles the direction internally based on key mappings.
        // We are directly setting analogue values.
        // By default, a positive Y for `this.axisValues.y` should mean "forward" for wasd-controls
        // and a positive X for `this.axisValues.x` should mean "right" for wasd-controls.

        // Oculus thumbstick forward Y is negative. For wasd-controls, a positive analogue value moves forward.
        // So, we multiply by -1 to align.
        // If your specific controller provides positive Y for forward, remove this negation.
        this.axisValues.y *= -1; 
    },

    tick: function () {
        if (this.wasdControls) {
            // Manually update the analogue property of wasd-controls
            // This property is not officially documented but is used internally
            // wasd-controls expects an object { x: strafe, y: forward, z: 0 }
            // where positive y is forward, negative y is backward
            // positive x is right, negative x is left

            // Directly setting `analogue` on wasd-controls is a bit of a hack
            // as it's an internal detail. A more robust way might be to simulate
            // key presses, but that's more complex. This usually works.
            this.wasdControls.analogue = {
                x: this.axisValues.x, // Strafe
                y: this.axisValues.y, // Forward/Backward
                z: 0 // No up/down from here
            };
        }
    },

    remove: function () {
        this.el.removeEventListener('axismove', this.onAxisMove);
        if (this.wasdControls) {
            // Reset analogue controls when component is removed
            this.wasdControls.analogue = { x: 0, y: 0, z: 0 };
        }
    }
});