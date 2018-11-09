module.exports = function(RED) {

	const EventSource = require("particle-api-js");

	// **************************************************************************
	// ParticlePublish node - base module for submitting events to Particle Cloud
	// **************************************************************************
	function ParticlePublish(n) {
		// note:
		// the node-RED 'n' object refers to a node's instance configuration and so is unique between ParticlePublish nodes

		var particlemodule = null;

		RED.nodes.createNode(this, n);

		particlemodule = this;

		// Get all properties from node instance settings
		this.config = n;
		this.param = n.param; // string data to send as part of published Particle Event
		this.evtname = n.evtname; // name of Particle Event to publish
		this.pcloud = RED.nodes.getNode(n.pcloud);
		this.evtnametopic = n.evtnametopic;
		this.private = n.private;
		if(n.ttl === "" || n.ttl == null) {
			this.ttl = 60;
		} else {
			this.ttl = n.ttl;
		}
		this.once = n.once;
		this.interval_id = null;
		this.repeat = Number(n.repeat) * 1000;
		this.consolelog = n.consolelog;
		this.timeoutDelay = 5; // ms

		// keep track of updated state (for updating status icons)
		this.propChanged = false;

		if (this.pcloud.host === "https://api.particle.io") {
			this.isLocal = false;
		} else {
			this.isLocal = true;
		}

		if (this.pcloud.credentials.accesstoken == null || this.pcloud.credentials.accesstoken === "") {
			this.status({
				fill: "red",
				shape: "dot",
				text: "No Particle access token"
			});
			this.error("No Particle access token in configuration node");
		} else {
			this.status({});
		}

		if (this.once) { // run on init, if requested
			setTimeout(function() {
				particlemodule.emit("callPublish", {});
			}, this.timeoutDelay);
		}

		// Called when there's an input from upstream node(s)
		this.on("input", function(msg) {
			// Retrieve all parameters from Message
			var validOp = false;
			var repeatChanged = false;
			var val = msg;
			var execPub = false;

			// ignore if incoming message is invalid
			if (val != null) {
				if (val.topic === "evtname") {				// set new Event name; does not trigger publish Event
					this.evtname = val.payload;
					this.propChanged = true;
					if (this.consolelog) console.log("(ParticlePublish) new publish Event name:", this.evtname);
					validOp = true;
				} else if (val.topic === "param") {		// new param (string data); trigger publish Event AND send param
					if (this.consolelog) console.log("(ParticlePublish) new param:", val.payload);
					validOp = execPub = true;
				} else if (val.topic === "repeat") {	// new repeat interval; updates interval timer (which in turn will trigger publish Event)
					val.payload = Number(val.payload) * 1000;
					this.repeat = val.payload;
					if (this.consolelog) console.log("(ParticlePublish) input new repeat (ms):", this.repeat);
					validOp = repeatChanged = true;
				} else if (this.evtnametopic && val.topic.length > 0) {
					// alternative usage mode: if user has selected the "Use topic as Event Name?" option
					this.evtname = val.topic;
					this.param = val.payload;
					if (this.consolelog) console.log("(ParticlePublish) evtnametopic publish Event:", this.evtname, ":", this.param);
					validOp = execPub = true;
				} else if ((val.topic == null || val.topic == "") && val.payload != null) {
					// 'shortcut' mode - easier way to publish the Event without specifying "param" as topic
					// a Particle Publish Event has the option of sending a data string along with the published Event
					// To streamline the use of the Publish node, any incoming payload (without a topic) should trigger the Event – but NOT send any data
					// To send data as part of the publish Event, the upstream message MUST include the topic "param"
					val.payload = "";
					validOp = execPub = true;
					if (this.consolelog) console.log("(ParticlePublish) shortcut publish Event:", this.evtname);
				}
			}

			if (validOp) {
				// signal to user that incoming messages have modified node settings
				if (execPub) {
					this.status({
						fill: "blue",
						shape: "dot",
						text: this.evtname + ":" + this.param + " SENT"
					});
				} else {
					this.status({
						fill: "green",
						shape: "ring",
						text: val.topic + " changed to " + val.payload
					});
				}

				if (repeatChanged) {
					// clear previous interval as we're setting this up again
					clearInterval(this.interval_id);
					this.interval_id = null;

					setTimeout(function() {
						particlemodule.emit("processPublish", {});
					}, this.timeoutDelay);
				}
			}

			if (execPub) {
				if (this.evtname.length === 0 || this.evtname === "") { // Catch blank event name
					this.evtname = "NodeRED";
				}

				if (val && val.payload && val.payload.length > 0) {
					this.param = val.payload;
				}

				setTimeout(function() {
					particlemodule.emit("processPublish", {});
				}, this.timeoutDelay);
			}

		});

		// Perform operations based on the method parameter.
		this.on("processPublish", function() {
			// Check for repeat and start timer
			if (this.repeat && !isNaN(this.repeat) && this.repeat > 0) {
				if (this.consolelog) console.log("(ParticlePublish) setting new repeat rate (ms):", this.repeat);

				this.interval_id = setInterval(function() {
					particlemodule.emit("callPublish", {});
				}, this.repeat);
			}
			// There is no repeat, just start once
			else if (this.evtname && this.evtname.length > 0) {
				if (this.consolelog) console.log("(ParticlePublish) no repeat");

				setTimeout(function() {
					particlemodule.emit("callPublish", {});
				}, this.timeoutDelay);
			}
		});

		// Execute actual Publish Event call
		this.on("callPublish", function() {
			var url = this.pcloud.host + ":" + this.pcloud.port + "/v1/devices/events";

			if (this.consolelog) {
				console.log("(ParticlePublish) Calling function...");
				console.log("\tURL:", url);
				console.log("\tEvent Name:", this.evtname);
				console.log("\tPrivate:", this.private);
				console.log("\tTTL:", this.ttl);
				console.log("\tParameter(s):", this.param);
			}

			// build POST data and publish Particle Event
			Request.post(
				url, {
					form: {
						access_token: this.pcloud.credentials.accesstoken,
						name: this.evtname,
						data: this.param,
						private: this.private,
						ttl: this.ttl
					}
				},
				function(error, response, body) {
					// If not error then prepare message and send
					if (!error && response.statusCode == 200) {
						var data = JSON.parse(body);
						var msg = {
							raw: data,
							payload: data.ok
						};
						particlemodule.send(msg);
					}
				}
			);
		});

		this.on("close", function() {
			if (this.interval_id != null) {
				if (this.consolelog) console.log("(ParticlePublish) Interval closed.");
				clearInterval(this.interval_id);
			}
		});
	}
	// register ParticlePublish node
	RED.nodes.registerType("ParticlePublish out", ParticlePublish);
	// end ParticlePublish

};
