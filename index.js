const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const fetch = require('node-fetch');

// Render-এর এনভায়রনমেন্ট ভেরিয়েবল থেকে টোকেন নেওয়া হবে
const TOKEN = process.env.TELEGRAM_TOKEN; 

if (!TOKEN) {
    console.error("Error: TELEGRAM_TOKEN environment variable is missing!");
    process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });
const app = express();
app.use(express.json());

const userInboxes = new Map();
const DOMAINS = ["1secmail.com", "1secmail.org", "1secmail.net"];

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 
        `⚡ *স্বাগতম Temp Mail Bot-এ!*\n\n` +
        `📌 *কমান্ডসমূহ:*\n` +
        `👉 /generate - নতুন ইমেল অ্যাড্রেস নিন\n` +
        `👉 /inbox - ইনবক্স চেক করুন`, 
        { parse_mode: 'Markdown' }
    );
});

bot.onText(/\/generate/, async (msg) => {
    const chatId = msg.chat.id;
    const username = 'user_' + Math.random().toString(36).substring(2, 10);
    const domain = DOMAINS[Math.floor(Math.random() * DOMAINS.length)];
    const email = `${username}@${domain}`;

    userInboxes.set(chatId, { username, domain, email });

    bot.sendMessage(chatId, 
        `✅ *আপনার নতুন টেম্প মেইল তৈরি হয়েছে:*\n\n` +
        `\`${email}\`\n\n` +
        `মেইল আসার পর চেক করতে /inbox লিখুন।`, 
        { parse_mode: 'Markdown' }
    );
});

bot.onText(/\/inbox/, async (msg) => {
    const chatId = msg.chat.id;
    const userData = userInboxes.get(chatId);

    if (!userData) {
        bot.sendMessage(chatId, `❌ আপনার কোনো সক্রিয় ইমেল নেই। নতুন ইমেল পেতে /generate লিখুন।`);
        return;
    }

    try {
        const response = await fetch(`https://www.1secmail.com/api/v1/?action=getMessages&login=${userData.username}&domain=${userData.domain}`);
        const messages = await response.json();

        if (messages.length === 0) {
            bot.sendMessage(chatId, `📭 আপনার ইনবক্স খালি। কোনো নতুন মেইল আসেনি।`);
            return;
        }

        for (let mail of messages) {
            const mailRes = await fetch(`https://www.1secmail.com/api/v1/?action=readMessage&login=${userData.username}&domain=${userData.domain}&id=${mail.id}`);
            const mailData = await mailRes.json();

            bot.sendMessage(chatId, 
                `📩 *নতুন ইমেল এসেছে!*\n\n` +
                `👤 *প্রেরক:* ${mailData.from}\n` +
                `📌 *বিষয়:* ${mailData.subject}\n\n` +
                `📝 *বার্তা:*\n${mailData.textBody || mailData.body}`, 
                { parse_mode: 'Markdown' }
            );
        }
    } catch (err) {
        console.error(err);
        bot.sendMessage(chatId, `⚠️ মেইল চেক করতে গিয়ে সমস্যা হয়েছে। আবার চেষ্টা করুন।`);
    }
});

app.get('/', (req, res) => {
    res.send('Telegram Temp Mail Bot is running on Render!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
