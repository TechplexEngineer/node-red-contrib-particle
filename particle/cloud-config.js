/*
  https://github.com/chuank/node-red-contrib-particle
*/

module.exports = function(RED) {

	// ******************************************
	// Configuration module - handles credentials
	// ******************************************
	function ParticleCloudNode(n) {
		RED.nodes.createNode(this, n);
		this.host = n.host;
		this.port = n.port;
		this.prodidorslug = n.prodidorslug;
		this.name = n.name;
	}
	// register the existence of the Particle Cloud credentials configuration node
	RED.nodes.registerType("particle-cloud", ParticleCloudNode, {
		credentials: {
			accesstoken: {type: "password"}
		}
	});
};
