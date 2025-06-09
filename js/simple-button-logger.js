// simple-button-logger.js
AFRAME.registerComponent('simple-button-logger', {
  init: function () {
    const elId = this.el.id || 'unnamed entity';
    console.log(`[SimpleButtonLogger] Initialized on: ${elId}`);
    console.log(`[SimpleButtonLogger] Listening for 'abuttondown', 'bbuttondown', and generic 'buttondown' events.`);

    this.el.addEventListener('abuttondown', function (evt) {
      console.log(`[SimpleButtonLogger] ---> A BUTTON DOWN detected on: ${elId}`);
    });
    this.el.addEventListener('abuttonup', function (evt) {
      console.log(`[SimpleButtonLogger] ---> A BUTTON UP detected on: ${elId}`);
    });

    this.el.addEventListener('bbuttondown', function (evt) {
      console.log(`[SimpleButtonLogger] ---> B BUTTON DOWN detected on: ${elId}`);
    });
    this.el.addEventListener('bbuttonup', function (evt) {
      console.log(`[SimpleButtonLogger] ---> B BUTTON UP detected on: ${elId}`);
    });

    // Generic listener to catch any button press and see its details
    this.el.addEventListener('buttondown', function(evt) {
        console.log(`[SimpleButtonLogger] ---> GENERIC BUTTON DOWN - Event Detail ID: ${evt.detail.id}, Full Detail:`, JSON.stringify(evt.detail));
    });
     this.el.addEventListener('buttonup', function(evt) {
        console.log(`[SimpleButtonLogger] ---> GENERIC BUTTON UP - Event Detail ID: ${evt.detail.id}, Full Detail:`, JSON.stringify(evt.detail));
    });

    // For Oculus Touch, grip and trigger are common too
    this.el.addEventListener('gripdown', function (evt) {
      console.log(`[SimpleButtonLogger] ---> GRIP DOWN detected on: ${elId}`);
    });
    this.el.addEventListener('triggerdown', function (evt) {
      console.log(`[SimpleButtonLogger] ---> TRIGGER DOWN detected on: ${elId}`);
    });
  }
});