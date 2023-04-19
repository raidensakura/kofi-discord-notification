// Modified from: https://github.com/eramsorgr/kofi-discord-alerts
const express = require('express');
const serverless = require('serverless-http');
const app = express();
const bodyParser = require('body-parser');
const { Webhook, MessageBuilder } = require('discord-webhook-node');
const request = require('request');
const URL = require("url").URL;
const { Octokit } = require("@octokit/core");
const { createLogger, format, transports } = require("winston");

const logLevels = {
	fatal: 0,
	error: 1,
	warn: 2,
	info: 3,
	debug: 4,
	trace: 5,
};

const logger = createLogger({
	levels: logLevels,
	transports: [new transports.Console()],
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use('/', async function (req, res) {

	// Check for needed secrets
	const stringIsAValidUrl = (s) => {
		try {
			new URL(s);
			return true;
		} catch (err) {
			return false;
		}
	};
	const webhook_url = process.env.WEBHOOK_URL;
	if (!webhook_url || !stringIsAValidUrl(webhook_url)) {
		return res.json({ success: false, error: 'Invalid Webhook URL.' });
	}

	const kofi_token = process.env.KOFI_TOKEN;
	if (!kofi_token) return res.json({ success: false, error: 'Ko-fi token required.' });

	const kofi_username = process.env.KOFI_USERNAME;

	const webhook = new Webhook(webhook_url);

	// Check if payload data is valid
	const data = req.body.data;
	if (!data) return res.json(`Hello world.`);
	const payload = JSON.parse(data);

	// Check if kofi token is valid
	if (payload.verification_token !== kofi_token) {
		return res.json({ success: false, error: 'Ko-fi token does not match.' });
	}

	// Strip sensitive info from payload
	try {
		censor = '*****';
		payload['verification_token'] = censor;
		payload['email'] = censor;
		payload['kofi_transaction_id'] = censor;
		payload['shipping'] = censor;
	} catch {
		return res.json({ success: false, error: 'Payload data invalid.' });
	}

	// Send Discord embed
	try {
		const embed = new MessageBuilder();

		embed.setAuthor('Ko-fi', 'https://i.imgur.com/J0egcX2.png');
		embed.setThumbnail('https://i.imgur.com/J0egcX2.png');
		embed.setTitle('New supporter on Ko-fi ☕');
		if (kofi_username) embed.setURL(`https://ko-fi.com/${kofi_username}`);

		switch (payload.tier_name) {
			case 'Silver':
				embed.setColor('#797979');
			case 'Gold:':
				embed.setColor('#ffc530');
			case 'Platinum':
				embed.setColor('#2ed5ff');
			default:
				embed.setColor('#9b59b6');
		}

		embed.addField(`From`, `${payload.from_name}`, true);
		embed.addField(`Type`, `${payload.type}`, true);
		embed.addField(`Amount`, `${payload.amount} ${payload.currency}`, true);
		if (payload.message && payload.message !== 'null')
			embed.addField(`Message`, `${payload.message}`);
		embed.setFooter(
			`Thank you for supporting us!`,
			`https://i.imgur.com/J0egcX2.png`
		);
		embed.setTimestamp();

		await webhook.send(embed);
	} catch (err) {
		console.error(err);
		return res.json({ success: false, error: err });
	}

	logger.info(`Processed payload ${payload.message_id}.`);

	res.json({ success: true });

	// Return early if gist stuff not provided
	if (!process.env.GIST_URL || !process.env.GIST_TOKEN) return;

	// Request for gist content
	request(process.env.GIST_URL, { json: true }, async (error, resp, body) => {
		if (error) {
			return logger.error(`Problem retrieving gist content: \n${error}`);
		};

		if (resp.statusCode == 404) {
			return logger.error(`Problem retrieving gist: Not found.`);
		}

		let supporters = body || [];

		if (!error && resp.statusCode == 200) {
			try {
				supporters.push(payload);
			} catch (error) {
				return logger.error(`Problem retrieving gist: ${error}.`);
			}
		};

		return await updateGist(supporters);
	});

	async function updateGist(supporters) {
		const octokit = new Octokit({
			auth: process.env.GIST_TOKEN
		})

		// Thanks ChatGPT
		const url = process.env.GIST_URL;
		const regex = /\/([\da-f]+)\/raw\//;

		const match = url.match(regex);

		if (match) {
			const gistId = match[1];
			let res = await octokit.request(`PATCH /gists/${gistId}`, {
				gist_id: gistId,
				description: `Last updated at ${Date.now()}`,
				files: {
					'kofi.json': {
						content: JSON.stringify(supporters)
					}
				},
				headers: {
					'X-GitHub-Api-Version': '2022-11-28'
				}
			})
			if (res.status == 200) {
				logger.info(`Updated gist for payload ${payload.message_id}.`);
			} else {
				logger.error(`Failed to update gist: ${res.status}`)
			}

		} else {
			return logger.error('Could not find your Gist ID from your Gist URL.');
		}
	}
});

module.exports.handler = serverless(app);

