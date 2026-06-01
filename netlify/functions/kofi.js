const { Webhook, MessageBuilder } = require('discord-webhook-node');
const { Octokit } = require('@octokit/core');
const { URL } = require('url');

const HEADERS = { 'Content-Type': 'application/json' };

const jsonResponse = (body, status = 200) => ({ statusCode: status, headers: HEADERS, body: JSON.stringify(body) });

const isValidUrl = (value) => {
	try {
		new URL(value);
		return true;
	} catch {
		return false;
	}
};

const safeString = (value) => {
	if (value == null) return '';
	return String(value).trim();
};

const cleanPayload = (payload) => {
	const sanitized = { ...payload };
	delete sanitized.verification_token;
	delete sanitized.email;
	delete sanitized.kofi_transaction_id;
	delete sanitized.shipping;
	return sanitized;
};

const getGistId = (gistUrl) => {
	try {
		const parsed = new URL(gistUrl);
		const match = parsed.pathname.match(/\/(?<id>[0-9a-fA-F]+)(?:\/?|$)/);
		return match?.groups?.id || null;
	} catch {
		return null;
	}
};

const buildEmbed = (payload, username) => {
	const embed = new MessageBuilder();
	const tierColors = {
		Silver: '#797979',
		Gold: '#ffc530',
		Platinum: '#2ed5ff',
	};

	embed.setAuthor('Ko-fi', 'https://i.imgur.com/J0egcX2.png');
	embed.setThumbnail('https://i.imgur.com/J0egcX2.png');
	embed.setTitle('New Ko-fi support');

	if (safeString(username)) {
		embed.setURL(`https://ko-fi.com/${encodeURIComponent(username)}`);
	}

	embed.setColor(tierColors[payload.tier_name] || '#9b59b6');
	embed.addField('From', safeString(payload.from_name) || 'Unknown', true);
	embed.addField('Type', safeString(payload.type) || 'Unknown', true);
	embed.addField('Amount', `${safeString(payload.amount) || '0'} ${safeString(payload.currency) || ''}`.trim(), true);

	if (safeString(payload.tier_name)) {
		embed.addField('Tier', payload.tier_name, true);
	}

	const message = safeString(payload.message);
	if (message && message.toLowerCase() !== 'null') {
		embed.addField('Message', message);
	}

	embed.setFooter('Thank you for supporting us!', 'https://github.githubassets.com/images/modules/site/icons/funding_platforms/ko_fi.svg');
	embed.setTimestamp();

	return embed;
};

exports.handler = async (event) => {
	if (event.httpMethod !== 'POST') {
		return jsonResponse({ success: false, error: 'Only POST requests are supported.' }, 405);
	}

	const webhookUrl = process.env.WEBHOOK_URL;
	const kofiToken = process.env.KOFI_TOKEN;
	const kofiUsername = process.env.KOFI_USERNAME;
	const gistUrl = process.env.GIST_URL;
	const gistToken = process.env.GIST_TOKEN;

	if (!webhookUrl || !isValidUrl(webhookUrl)) {
		return jsonResponse({ success: false, error: 'Invalid WEBHOOK_URL.' }, 500);
	}

	if (!kofiToken) {
		return jsonResponse({ success: false, error: 'Missing KOFI_TOKEN.' }, 500);
	}

	let body;
	try {
		body = JSON.parse(event.body || '{}');
	} catch (error) {
		return jsonResponse({ success: false, error: 'Request body is not valid JSON.' }, 400);
	}

	if (!body.data) {
		return jsonResponse({ success: true, message: 'Ko-fi webhook listener is alive.' });
	}

	let payload;
	try {
		payload = typeof body.data === 'string' ? JSON.parse(body.data) : body.data;
	} catch (error) {
		return jsonResponse({ success: false, error: 'Invalid Ko-fi payload data.' }, 400);
	}

	if (payload.verification_token !== kofiToken) {
		return jsonResponse({ success: false, error: 'Ko-fi token does not match.' }, 401);
	}

	const webhook = new Webhook(webhookUrl);
	const embed = buildEmbed(payload, kofiUsername);

	try {
		await webhook.send(embed);
	} catch (error) {
		console.error('Discord webhook send failed:', error);
		return jsonResponse({ success: false, error: 'Discord delivery failed.' }, 502);
	}

	if (!gistUrl || !gistToken) {
		return jsonResponse({ success: true });
	}

	const gistId = getGistId(gistUrl);
	if (!gistId) {
		return jsonResponse({ success: false, error: 'Invalid GIST_URL.' }, 400);
	}

	const octokit = new Octokit({ auth: gistToken });
	let supporters = [];

	try {
		const gistResponse = await octokit.request('GET /gists/{gist_id}', { gist_id: gistId });
		const gistFile = gistResponse.data.files?.['kofi.json'];

		if (gistFile && typeof gistFile.content === 'string' && gistFile.content.trim()) {
			supporters = JSON.parse(gistFile.content);
			if (!Array.isArray(supporters)) supporters = [];
		}
	} catch (error) {
		console.error('Unable to read Gist:', error);
		return jsonResponse({ success: false, error: 'Unable to retrieve Gist content.' }, 502);
	}

	supporters.push(cleanPayload(payload));

	try {
		await octokit.request('PATCH /gists/{gist_id}', {
			gist_id: gistId,
			description: `Updated ${new Date().toISOString()}`,
			files: {
				'kofi.json': {
					content: JSON.stringify(supporters, null, 2),
				},
			},
		});
	} catch (error) {
		console.error('Unable to update Gist:', error);
		return jsonResponse({ success: false, error: 'Unable to update Gist.' }, 502);
	}

	return jsonResponse({ success: true });
};

