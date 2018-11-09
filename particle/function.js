/*
  https://github.com/chuank/node-red-contrib-particle
*/

module.exports = function(RED) {
	const particle = require('particle-api-js');


	// ***************************************************************************
	// ParticleFunc node - base module for calling Particle device cloud functions
	// ***************************************************************************
	function ParticleFunc(n) {
		// note: code in here runs whenever flow is re-deployed.
		// the node-RED 'n' object refers to a node's instance configuration and so is unique between ParticleFunc nodes

		var particlemodule = null;

		RED.nodes.createNode(this, n);

		particlemodule = this;

		// Get all properties
		this.config = n;
		this.pcloud = RED.nodes.getNode(n.pcloud);
		this.devid = n.devid;
		this.fname = n.fname;
		this.param = n.param;
		this.once = n.once;
		this.interval_id = null;
		this.repeat = n.repeat * 1000;
		this.consolelog = n.consolelog;
		this.timeoutDelay = 5; //ms

		(this.pcloud.host === "https://api.particle.io") ? this.isLocal = false: this.isLocal = true;

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

		// Check device id
		if (this.devid == null || this.devid === "") {
			this.status({
				fill: "yellow",
				shape: "dot",
				text: "No Device ID"
			});
			this.error("No Particle Device ID set");
		} else {
			this.status({});
		}

		if (this.once) { // run on init, if requested
			setTimeout(function() {
				particlemodule.emit("processFunc", {});
			}, this.timeoutDelay);
		}

		// Called when there's an input from upstream node(s)
		this.on("input", function(msg) {
			// Retrieve all parameters from Message
			var validOp = false;
			var repeatChanged = false;
			var val = msg;
			var execFunc = false;

			// ignore if incoming message is invalid
			if (val != null) {
				if (val.topic === "devid") {
					this.devid = val.payload;
					if (this.consolelog) console.log("(ParticleFunc) input new devid:", this.devid);
					validOp = true;
				} else if (val.topic === "fname") {
					this.fname = val.payload;
					if (this.consolelog) console.log("(ParticleFunc) input new funcName:", this.fname);
					validOp = true;
				} else if (val.topic === "param") {
					this.param = val.payload;
					if (this.consolelog) console.log("(ParticleFunc) input new param:", this.param);
					validOp = execFunc = true;
				} else if (val.topic === "repeat") {
					this.repeat = Number(val.payload) * 1000;
					if (this.consolelog) console.log("(ParticleFunc) input new repeat (ms):", this.repeat);
					validOp = repeatChanged = true;
				} else if ((val.topic == null || val.topic == "") && val.payload != null) { // 'shortcut' mode - easier way to call the function without specifying "param" as topic
					this.param = val.payload;
					validOp = execFunc = true;
					if (this.consolelog) console.log("(ParticleFunc) shortcut func call:", this.param);
				}
			}

			if (validOp) {
				// signal to user that incoming messages have modified node settings
				if (execFunc) {
					this.status({
						fill: "blue",
						shape: "dot",
						text: val.payload
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
						particlemodule.emit("processFunc", {});
					}, this.timeoutDelay);
				}
			}

			if (execFunc) {
				val = msg.payload;
				// Retrieve payload as param
				if (val && val.length > 0) {
					this.param = val;
				}

				setTimeout(function() {
					particlemodule.emit("processFunc", {});
				}, this.timeoutDelay);
			}

		});

		// Call Particle Function
		this.on("processFunc", function() {
			// Check for repeat and start timer
			if (this.repeat && !isNaN(this.repeat) && this.repeat > 0) {
				if (this.consolelog) console.log("(ParticleFunc) input new repeat (ms):", this.repeat);

				this.interval_id = setInterval(function() {
					particlemodule.emit("callFunc", {});
				}, this.repeat);

			}
			// There is no repeat, just start once
			else if (this.fname && this.fname.length > 0) {
				setTimeout(function() {
					particlemodule.emit("callFunc", {});
				}, this.timeoutDelay);
			}
		});

		// Execute actual Particle Device function call
		this.on("callFunc", function() {
			var url = this.pcloud.host + ":" + this.pcloud.port + "/v1/devices/" + this.devid + "/" + this.fname;

			if (this.consolelog) {
				console.log("(ParticleFunc) Calling function...");
				console.log("\tURL:", url);
				console.log("\tDevice ID:", this.devid);
				console.log("\tFunction Name:", this.fname);
				console.log("\tParameter(s):", this.param);
			}

			// build POST data and call Particle Device function
			Request.post(
				url, {
					form: {
						access_token: this.pcloud.credentials.accesstoken,
						args: this.param
					}
				},
				function(error, response, body) {
					// If not error then prepare message and send
					if (!error && response.statusCode == 200) {
						var data = JSON.parse(body);
						var msg = {
							raw: data,
							payload: data.return_value,
							id: data.id
						};
						particlemodule.send(msg);
					}
				}
			);
		});

		this.on("close", function() {
			if (this.interval_id != null) {
				if (this.consolelog) console.log("(ParticleFunc) Interval closed.");
				clearInterval(this.interval_id);
			}
		});
	}
	// register ParticleFunc node
	RED.nodes.registerType("ParticleFunc out", ParticleFunc);

};
