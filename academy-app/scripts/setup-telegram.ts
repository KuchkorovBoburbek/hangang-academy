import '../lib/env';
async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const url = process.env.APP_URL;
  if (!token || !secret || !/^[A-Za-z0-9_-]{32,256}$/.test(secret) || !url?.startsWith('https://'))
    throw new Error('Bot tokeni, kamida 32 belgili webhook siri va HTTPS APP_URL sozlang.');
  const appUrl = new URL(url);
  if (appUrl.pathname !== '/' || appUrl.search || appUrl.hash || appUrl.username || appUrl.password)
    throw new Error('APP_URL faqat HTTPS domen bo‘lishi kerak.');
  const health = await fetch(`${appUrl.origin}/api/health`, { signal: AbortSignal.timeout(15000) });
  if (!health.ok || (await health.json()).service !== 'HangangAcademy')
    throw new Error('Saytning HTTPS manzili hali tayyor emas.');
  const identity = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
    signal: AbortSignal.timeout(15000),
  });
  const bot = await identity.json();
  if (!identity.ok || !bot.ok) throw new Error('Telegram bot tokeni yaroqsiz.');
  if (
    bot.result.username.toLowerCase() !==
    process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, '').toLowerCase()
  )
    throw new Error('TELEGRAM_BOT_USERNAME token egasi bo‘lgan botga mos emas.');
  for (const [method, body] of Object.entries({
    setWebhook: {
      url: `${url.replace(/\/$/, '')}/api/telegram/webhook`,
      secret_token: secret,
      allowed_updates: ['message', 'callback_query'],
    },
    setChatMenuButton: {
      menu_button: { type: 'web_app', text: 'HangangAcademy', web_app: { url } },
    },
  })) {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    const data = (await response.json()) as { ok: boolean };
    if (!response.ok || !data.ok) throw new Error(`Telegram ${method} sozlamasi qabul qilinmadi.`);
  }
  const response = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`, {
    signal: AbortSignal.timeout(15000),
  });
  const webhook = await response.json();
  if (!response.ok || !webhook.ok || webhook.result.url !== `${appUrl.origin}/api/telegram/webhook`)
    throw new Error('Telegram webhook manzili tasdiqlanmadi.');
  console.log('Telegram webhook va ilovani ochish tugmasi sozlandi.');
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : 'Telegram sozlanmadi.');
  process.exitCode = 1;
});
