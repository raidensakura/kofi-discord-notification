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

	// Color palette by type
	const typeColors = {
		tip: '#9b59b6',
		subscription: '#16a085',
		commission: '#e67e22',
		'shop order': '#2ecc71',
	};

	const koFiAuthorIcon = 'https://cdn.prod.website-files.com/5c14e387dab576fe667689cf/670f5a01229bf8a18f97a3c1_favion.png';
	const koFiThumbnail = 'https://cdn.prod.website-files.com/5c14e387dab576fe667689cf/670f5a0172b90570b1c21dab_kofi_logo.png';
	embed.setAuthor('Ko-fi', koFiAuthorIcon);
	embed.setThumbnail(koFiThumbnail);

	const typeRaw = safeString(payload.type).toLowerCase();
	const isPublic = payload.hasOwnProperty('is_public') ? Boolean(payload.is_public) : true;
	const fromName = isPublic ? (safeString(payload.from_name) || 'Anonymous') : 'Private supporter';

	// Set title and color based on type
	let title = 'New Ko-fi support';
	let color = '#34495e';

	if (payload.is_subscription_payment) {
		color = typeColors.subscription;
		title = payload.is_first_subscription_payment
			? '🆕 New membership (first payment)'
			: '💚 Subscription payment received';
	} else if (typeRaw.includes('tip')) {
		color = typeColors.tip;
		title = '💜 New tip received';
	} else if (typeRaw.includes('commission')) {
		color = typeColors.commission;
		title = '🎨 New commission received';
	} else if (typeRaw.includes('shop')) {
		color = typeColors['shop order'];
		title = '🛍️ New shop order';
	}

	embed.setTitle(title);
	if (safeString(username)) {
		embed.setURL(`https://ko-fi.com/${encodeURIComponent(username)}`);
	}
	embed.setColor(color);

	// Always include basic info
	embed.addField('From', fromName, true);
	embed.addField('Type', safeString(payload.type) || 'Unknown', true);
	embed.addField('Amount', `${safeString(payload.amount) || '0'} ${safeString(payload.currency) || ''}`.trim(), true);

	// Subscription fields
	if (payload.is_subscription_payment) {
		if (safeString(payload.tier_name)) {
			embed.addField('Tier', `${payload.tier_name}`, true);
		}
		embed.addField('Status', payload.is_first_subscription_payment ? 'Welcome! 🎉' : 'Monthly', true);
	}

	// Shop order items
	if (Array.isArray(payload.shop_items) && payload.shop_items.length > 0) {
		const itemsList = payload.shop_items.map((item) => {
			const name = safeString(item.direct_link_code ? `${item.direct_link_code}` : item.name || 'Item');
			const qty = item.quantity || 1;
			return `• ${name} (x${qty})`;
		}).join('\n');
		embed.addField('Items', itemsList, false);
	}

	// Message field (respect privacy)
	const message = safeString(payload.message);
	if (isPublic && message && message.toLowerCase() !== 'null') {
		embed.addField('Message', `"${message}"`);
	} else if (!isPublic && message) {
		embed.addField('Message', '🔒 Private message');
	}

	// Footer with message ID for tracing
	const footerText = payload.message_id ? `ID: ${payload.message_id}` : 'Ko-fi notification';
	embed.setFooter(`Thank you for supporting us! • ${footerText}`, koFiAuthorIcon);
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

	// Parse form-encoded body from Ko-fi
	let body;
	const contentType = event.headers['content-type'] || '';

	if (contentType.includes('application/x-www-form-urlencoded')) {
		// Parse URL-encoded form data
		const params = new URLSearchParams(event.body);
		body = {
			data: params.get('data'),
		};
	} else {
		// Fallback to JSON parsing
		try {
			body = JSON.parse(event.body || '{}');
		} catch (error) {
			return jsonResponse({ success: false, error: 'Request body is not valid.' }, 400);
		}
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

