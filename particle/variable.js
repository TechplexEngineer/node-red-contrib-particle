module.exports = function(RED) {
	const EventSource = require("particle-api-js");

	// ***********************************************************************
	// ParticleVar node - base module for retrieving Particle device variables
	// ***********************************************************************
	function ParticleVar(n) {
		// note: code in here runs whenever flow is re-deployed.
		// the node-RED 'n' object refers to a node's instance configuration and so is unique between ParticleVar nodes

		var particlemodule = null;

		RED.nodes.createNode(this, n);

		particlemodule = this;

		// Get all properties
		this.config = n;
		this.pcloud = RED.nodes.getNode(n.pcloud);
		this.devid = n.devid;
		this.getvar = n.getvar;
		this.once = n.once;
		this.interval_id = null;
		this.repeat = n.repeat * 1000;
		this.consolelog = n.consolelog;
		this.timeoutDelay = 5;

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
				text: ""
			});
			this.error("No Particle Device ID set");
		} else {
			this.status({});
		}

		if (this.once) { // run on init, if requested
			setTimeout(function() {
				particlemodule.emit("processVar", {});
			}, this.timeoutDelay);
		}

		// Called when there's an input from upstream node(s)
		this.on("input", function(msg) {
			// Retrieve all parameters from Message
			var validOp = false;
			var repeatChanged = false;
			var val = msg;

			// ignore if incoming message is invalid
			if (val != null) {
				if (val.topic === "devid") {
					this.devid = val.payload;
					if (this.consolelog) console.log("(ParticleVar) input new devid:", this.devid);
					validOp = true;
				} else if (val.topic === "getvar") {
					this.getvar = val.payload;
					if (this.consolelog) console.log("(ParticleVar) input new varName:", this.getvar);
					validOp = true;
				} else if (val.topic === "repeat") {
					val.payload = Number(val.payload) * 1000;
					this.repeat = val.payload;
					if (this.consolelog) console.log("(ParticleVar) input new repeat (ms):", this.repeat);
					validOp = repeatChanged = true;
				}
			}

			if (validOp) {
				// here we signal that incoming messages have modified node settings
				this.status({
					fill: "green",
					shape: "ring",
					text: val.topic + " modified to " + val.payload
				});

				if (repeatChanged) {
					// clear previous interval as we're setting this up again
					clearInterval(this.interval_id);
					this.interval_id = null;

					setTimeout(function() {
						particlemodule.emit("processVar", {});
					}, this.timeoutDelay);
				}

			} else { // it's just a regular variable request; any incoming message (even 'empty' ones) are fine

				setTimeout(function() {
					particlemodule.emit("getVar", {});
				}, this.timeoutDelay);

			}
		});

		// Perform operations based on the method parameter.
		this.on("processVar", function() {
			// Check for repeat and start timer
			if (this.repeat && !isNaN(this.repeat) && this.repeat > 0) {
				this.interval_id = setInterval(function() {
					particlemodule.emit("getVar", {});
				}, this.repeat);
			}
			// There is no repeat, just start once
			else if (this.getvar && this.getvar.length > 0) {
				setTimeout(function() {
					particlemodule.emit("getVar", {});
				}, this.timeoutDelay);
			}
		});

		// Read Particle Device variable
		this.on("getVar", function() {
			var url = this.pcloud.host + ":" + this.pcloud.port + "/v1/devices/" + this.devid + "/" + this.getvar + "?access_token=" + this.pcloud.credentials.accesstoken;

			if (this.consolelog) {
				console.log("(ParticleVar) Retrieving variable...");
				console.log("\tURL:", url);
				console.log("\tDevice ID:", this.devid);
				console.log("\tVariable Name:", this.getvar);
			}

			// Read Particle device variable and send output once response is received
			Request.get(url,
				function(error, response, body) {
					// console.log("(ParticleVar) received variable:", body);

					// If no error then prepare message and send to outlet
					if (!error && response.statusCode == 200) {
						var data = JSON.parse(body);

						var msg = {
							raw: data,
							payload: data.result,
							id: data.coreInfo.deviceID
						};

						particlemodule.send(msg);
					}
				}
			);
		});

		this.on("close", function() {
			if (this.interval_id != null) {
				if (this.consolelog) console.log("(ParticleVar) Interval closed.");
				clearInterval(this.interval_id);
			}
		});
	}
	// register ParticleVar node
	RED.nodes.registerType("ParticleVar", ParticleVar);
};
