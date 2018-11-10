module.exports = function(RED) {

	var Particle = require("particle-api-js");


	// *********************************************************************
	// ParticleEventStream node - base module for subscribing to Particle Cloud SSEs
	// *********************************************************************
	function ParticleEventStream(n) {
		// note: code in here runs whenever flow is re-deployed.
		// the node-RED 'n' object refers to a node's instance configuration and so is unique between ParticleSSE nodes

		var particlemodule = null;

		RED.nodes.createNode(this, n);

		particlemodule = this;

		// Get all properties from node instance settings
		// particlemodule.config = n;
		particlemodule.deviceID = n.deviceID;
		particlemodule.evtname = n.evtname;
		particlemodule.pcloud = RED.nodes.getNode(n.pcloud);
		particlemodule.consolelog = n.consolelog;
		particlemodule.timeoutDelay = 5; // ms

		// keep track of updated state (for updating status icons)
		particlemodule.propChanged = false;

		if (particlemodule.pcloud.credentials.accesstoken == null || particlemodule.pcloud.credentials.accesstoken === "") {
			particlemodule.status({
				fill: "red",
				shape: "dot",
				text: "No Particle access token"
			});
			particlemodule.error("No Particle access token in configuration node");
		} else {
			particlemodule.status({});
		}


		const particle = new Particle();

		if (particlemodule.eventStream) {
			particlemodule.eventStream.abort();
			particlemodule.eventStream = null;
		}

		const config = { //@todo handle bad input
			name: particlemodule.evtname.trim(),
			product: particlemodule.pcloud.credentials.prodidorslug.trim(),
			auth: particlemodule.pcloud.credentials.accesstoken.trim()};

		if (particlemodule.consolelog) console.log("(ParticleSSE) Config:", config);

		particle.getEventStream(config).then(function(stream) {
			particlemodule.status({
				fill: "green",
				shape: particlemodule.propChanged ? "ring" : "dot",
				text: particlemodule.propChanged ? "evtname/deviceID UPDATED OK" : "Connected"
			});
			if (particlemodule.consolelog) console.log("(ParticleSSE) Connected");
			particlemodule.eventStream = stream;

			stream.on('event', function(data) {
				let payload = data.data;
				try {
					payload = JSON.parse(payload)
				} catch(e) {
					console.log(e);
				}
				data.payload = payload;
				data.topic = data.name;

				particlemodule.send(data);
			}).on('end', (data) => {
				particlemodule.status({
					fill: "grey",
					shape: "dot",
					text: "Closed"
				});
				if (particlemodule.consolelog) console.log("(ParticleSSE) Closed");
			});
		}).catch(function(error) {
			particlemodule.status({
				fill: "red",
				shape: "ring",
				text: "Error - refer to log"
			});
			if (particlemodule.consolelog) console.log("(Particle SSE) Error: ",error);
		});

		particlemodule.on("close", function() {
			if (particlemodule.eventStream) {
				if (particlemodule.consolelog) console.log("(ParticleSSE) EventSource closed.");
				particlemodule.eventStream.abort();
				particlemodule.eventStream = null;
			}
		});
	}
	// register ParticleSSE node
	RED.nodes.registerType("event-stream", ParticleEventStream);
};
