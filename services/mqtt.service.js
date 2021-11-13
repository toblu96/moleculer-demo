"use strict";

const DbMixin = require("../mixins/db.mixin");
var mqtt = require('mqtt')

module.exports = {
	name: "mqtt",

	mixins: [DbMixin("mqtt")],

	settings: {

		// Available fields in the responses
		fields: [
			"_id",
			"name",
			"description",
			"topic",
			"group",
			"broker"
		],

		// Validator for the `create` & `insert` actions.
		entityValidator: {
			name: "string|min:3",
			description: "string|optional:true",
			topic: "string",
			group: "string|optional:true",
			broker: "url",
		},
	},

	dependencies: [],

	actions: {
		// override openapi spec from default action
		create: {
			openapi: {
				summary: "Creates a new MQTT subscription",
				tags: ["mqtt"],
				requestBody: {
					content: {
						"application/json": {
							schema: {
								"$ref": "#/components/schemas/mqtt.create",
							},
						},
					},
				},
				components: {
					// override generated schemas
					schemas: {
						"mqtt.create": {
							type: "object",
							properties: {
								"name": {
									type: "string",
									min: 3,
								},
								"description": {
									type: "string"
								},
								"broker": {
									type: "string",
									format: "url",
								},
								"topic": {
									type: "string"
								},
								"group": {
									type: "string"
								},
							},
							required: ["name", "topic", "broker"]
						},
					},
				},

			},
		},

	},

	events: {
	},

	/**
	 * Methods
	 */
	methods: {
		async openConnection() {
			this.client = mqtt.connect('mqtt://broker.emqx.io')

			// subscribe all topics from the database
			this.client.on('connect', async () => {

				let subscriptions = await this.broker.call('mqtt.list')
				for (let subsc of subscriptions.rows) {

					this.client.subscribe(`${subsc.topic}`, (err) => {
						if (err) {
							this.logger.warn(`Could not subscribe to topic ${subsc.topic}`)
							this.logger.warn(err)
						}
					})
				}

			})

			this.client.on('message', (topic, message) => {
				this.broker.emit("mqtt.message", message.toString());
			})
		},
		closeConnection() {
			this.client.end()
		},
		async reloadConnection() {
			this.client.end()

			this.client.on('end', async () => {
				this.openConnection()
			})
		}
	},

	/**
	 * Service created lifecycle event handler
	 */
	created() {

	},

	/**
	 * Service started lifecycle event handler
	 */
	async started() {
		this.openConnection()
	},

	/**
	 * Service stopped lifecycle event handler
	 */
	async stopped() {
		await this.closeConnection()
	},

	async entityChanged(type, json, ctx) {
		this.logger.info(`Entity ${type} (Change event) `);

		// reconnect to mqtt broker to reload all new topics
		await this.reloadConnection()
	},

};
