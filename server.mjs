import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const pagePath = path.join(here, 'koco-event-management.html');
const port = Number(process.env.PORT || 3000);
const model = process.env.OPENAI_MODEL || 'gpt-6-astra';
const maxBodyBytes = 24_000;
const guideInstructions = `You are Koco Guide, a friendly AI event-planning assistant for Koco, an event management studio. Help people plan anniversaries, birthdays, baptisms, engagement parties, baby showers, graduations, family reunions, weddings, dinners, and work events. Be warm, practical, and concise. Ask no more than two clarifying questions at a time. Offer useful ideas, checklists, guest-flow suggestions, timelines, and next steps. Never claim Koco has booked a vendor or confirmed availability. Never invent Koco prices, packages, locations, or policies. Encourage people to use the Koco contact form to discuss bookings. Stay focused on event planning.`;

function sendJson(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > maxBodyBytes) {
      const error = new Error('Message is too large. Please shorten it and try again.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('Please send a valid chat message.');
    error.statusCode = 400;
    throw error;
  }
}

async function handleGuideRequest(request, response) {
  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Use the chat box to send a message.' });
    return;
  }
  if (!process.env.OPENAI_API_KEY) {
    sendJson(response, 503, { error: 'The Koco Guide needs an OpenAI API key. Add it to your .env file, then restart the site.' });
    return;
  }

  const body = await readJsonBody(request);
  if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 12) {
    sendJson(response, 400, { error: 'Please send a shorter conversation and try again.' });
    return;
  }

  const messages = body.messages;
  const validMessages = messages.every(message =>
    message && ['user', 'assistant'].includes(message.role) &&
    typeof message.content === 'string' && message.content.trim().length > 0 &&
    message.content.length <= 1200
  );
  if (!validMessages || messages.at(-1).role !== 'user') {
    sendJson(response, 400, { error: 'Please send a valid message and try again.' });
    return;
  }

  try {
    const apiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        instructions: guideInstructions,
        input: messages,
        max_output_tokens: 500
      }),
      signal: AbortSignal.timeout(45_000)
    });
    const result = await apiResponse.json().catch(() => ({}));
    if (!apiResponse.ok) {
      console.error(`OpenAI request failed with status ${apiResponse.status}.`);
      sendJson(response, 502, { error: 'The Koco Guide could not reach its AI service. Please try again in a moment.' });
      return;
    }

    const answer = (result.output || [])
      .flatMap(item => item.content || [])
      .filter(item => item.type === 'output_text')
      .map(item => item.text)
      .join('\n')
      .trim();
    if (!answer) {
      sendJson(response, 502, { error: 'The guide could not make a reply just now. Please try again.' });
      return;
    }
    sendJson(response, 200, { answer });
  } catch (error) {
    console.error(`Koco Guide request failed: ${error.name || 'Error'}.`);
    sendJson(response, 502, { error: 'The guide is taking a little break. Please try again, or use the contact form.' });
  }
}

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname === '/api/guide') {
    try {
      await handleGuideRequest(request, response);
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message || 'Please try sending that message again.' });
    }
    return;
  }

  if (request.method === 'GET' && (pathname === '/' || pathname === '/koco-event-management.html')) {
    try {
      const page = await readFile(pagePath);
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(page);
    } catch {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('The Koco website page could not be opened.');
    }
    return;
  }

  response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end('Not found.');
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Koco is running at http://localhost:${port}`);
});
