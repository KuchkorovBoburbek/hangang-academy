export class TelegramError extends Error {
  constructor(
    message: string,
    public permanent = false,
  ) {
    super(message);
  }
}
export async function sendTelegram(chatId: string, text: string, markup?: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new TelegramError('Telegram bot sozlanmagan.');
  const url = process.env.APP_URL || '';
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text.slice(0, 4000),
      ...(markup
        ? { reply_markup: markup }
        : url.startsWith('https://')
          ? {
              reply_markup: {
                inline_keyboard: [[{ text: 'HangangAcademy’ni ochish', web_app: { url } }]],
              },
            }
          : {}),
    }),
  });
  const result = (await response.json()) as { ok: boolean; error_code?: number };
  if (!response.ok || !result.ok)
    throw new TelegramError(
      `Telegram xabari yuborilmadi (${result.error_code || response.status}).`,
      [400, 403].includes(result.error_code || response.status),
    );
}
