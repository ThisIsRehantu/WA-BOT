const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const chalk = require("chalk");

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");

    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        auth: state,
        printQRInTerminal: false  // QR mati, kita pakai pairing code
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection } = update;

        if (connection === "open") {
            console.log(chalk.green("✅ Bot WhatsApp sudah online!"));
        }

        // Pairing otomatis via ENV
        if (update.pairingCode && process.env.PAIRING_NUMBER) {
            console.log(chalk.yellow("🔑 Pairing Code:"), update.pairingCode);
            console.log(chalk.cyan(`📱 Masukkan kode di WhatsApp nomor ${process.env.PAIRING_NUMBER}`));
        }
    });
}

startBot();
