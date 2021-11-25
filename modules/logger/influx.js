"use strict";

const BaseLogger = require("moleculer").Loggers.Base;
const { MoleculerError } = require("moleculer").Errors;
const { InfluxDB, Point } = require('@influxdata/influxdb-client')

const { hostname } = require("os");
const _ = require("lodash");

/**
 * InfluxDB logger for Moleculer
 *
 * @class InfluxLogger
 * @extends {BaseLogger}
 */
class InfluxLogger extends BaseLogger {
	/**
	 * Creates an instance of InfluxLogger.
	 * @param {Object} opts
	 * @memberof InfluxLogger
	 */
	constructor(opts) {
		super(opts);

		this.opts = _.defaultsDeep(this.opts, {
			url: process.env.INFLUX_LOGGER_URL || "http://localhost:8086",
			token: process.env.INFLUX_LOGGER_TOKEN,
			org: process.env.INFLUX_LOGGER_ORG || 'personal',
			bucket: process.env.INFLUX_LOGGER_BUCKET || 'logging',
			hostname: hostname(),
			interval: 1 * 1000
		});

		this.queue = [];
		this.timer = null;
		this.writeApi = null;

		if (!this.opts.token)
			throw new MoleculerError(
				"InfluxDB API key is missing. Set INFLUX_LOGGER_TOKEN environment variable."
			);
	}

	/**
	 * Initialize logger.
	 *
	 * @param {LoggerFactory} loggerFactory
	 */
	init(loggerFactory) {
		super.init(loggerFactory);

		this.writeApi = new InfluxDB({ url: this.opts.url, token: this.opts.token }).getWriteApi(this.opts.org, this.opts.bucket, 'ms')

		if (this.opts.interval > 0) {
			this.timer = setInterval(async () => await this.flush(), this.opts.interval);
			this.timer.unref();
		}
	}

	/**
	 * Stopping logger
	 */
	async stop() {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}

		return await this.flush();
	}

	/**
	 * Generate a new log handler.
	 *
	 * @param {object} bindings
	 */
	getLogHandler(bindings) {
		let level = bindings ? this.getLogLevel(bindings.mod) : null;

		if (!level) return null;

		const printArgs = args => {
			return args.map(p => {
				if (this.isObject(p) || Array.isArray(p)) return this.objectPrinter(p);
				return p;
			});
		};
		const levelIdx = BaseLogger.LEVELS.indexOf(level);

		return async (type, args) => {
			const typeIdx = BaseLogger.LEVELS.indexOf(type);
			if (typeIdx > levelIdx) return;

			this.queue.push({
				ts: Date.now(),
				level: type,
				msg: printArgs(args).join(" "),
				bindings
			});

			if (!this.opts.interval) await this.flush();
		};
	}

	/**
	 * Flush queued log entries to InfluxDB.
	 */
	async flush() {

		if (this.queue.length > 0) {
			const rows = Array.from(this.queue);
			this.queue.length = 0;

			let points = rows.map(row => {
				return new Point('logger')
					.timestamp(row.ts)
					.tag('level', row.level)
					.tag('hostname', this.opts.hostname)
					.tag('nodeID', row.bindings.nodeID)
					.tag('namespace', row.bindings.ns)
					.tag('service', row.bindings.svc || 'none')
					.tag('version', row.bindings.ver)
					.stringField('value', row.msg)
			})

			this.writeApi.writePoints(points)

			try {
				await this.writeApi.flush()
			} catch (e) {
				console.error()
			}


		}

		return this.broker.Promise.resolve();
	}

	// Helper functions
	isObject(o) {
		return o !== null && typeof o === "object" && !(o instanceof String);
	}

}

module.exports = InfluxLogger;