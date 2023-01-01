// Modified from: https://github.com/eramsorgr/kofi-discord-alerts
const express = require('express');
const serverless = require('serverless-http');
const app = express();
const bodyParser = require('body-parser');
const { Webhook, MessageBuilder } = require('discord-webhook-node');
const webhook_url = process.env.WEBHOOK_URL;
const kofi_token = process.env.KOFI_TOKEN;
const kofi_username = process.env.KOFI_USERNAME;
const webhook = new Webhook(webhook_url);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use('/', async function (req, res) {
	const data = req.body.data;
	if (!data) return res.json(`Hello world.`);
	try {
		const obj = JSON.parse(data);
		if (obj.verification_token !== kofi_token)
			return res.json(`Invalid token provided.`);
		const embed = new MessageBuilder();

		embed.setAuthor('Ko-fi', 'https://i.imgur.com/J0egcX2.png');
		embed.setThumbnail('https://i.imgur.com/J0egcX2.png');
		embed.setTitle('New supporter on Ko-fi ☕');
		if (kofi_username) embed.setURL(`https://ko-fi.com/${kofi_username}`);

		switch (obj.tier_name) {
			case 'Silver':
				embed.setColor('#797979');
			case 'Gold:':
				embed.setColor('#ffc530');
			case 'Platinum':
				embed.setColor('#2ed5ff');
			default:
				embed.setColor('#9b59b6');
		}

		embed.addField(`From`, `${obj.from_name}`, true);
		embed.addField(`Type`, `${obj.type}`, true);
		embed.addField(`Amount`, `${obj.amount} ${obj.currency}`, true);
		if (obj.message && obj.message !== 'null')
			embed.addField(`Message`, `${obj.message}`);
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
	return res.json({ success: true });
});

module.exports.handler = serverless(app);

