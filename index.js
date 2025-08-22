// index.js (untuk verifikasi di Railway)
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
} = require("lily-baileys");

const botNumber = process.env.PAIRING_NUMBER; // Nomor WA dari Railway ENV
if (!botNumber) {
  console.error("❌ PAIRING_NUMBER env belum di set. Contoh: PAIRING_NUMBER=6281234567890");
  process.exit(1);
}

async function startVerify() {
  const { state, saveCreds } = await useMultiFileAuthState("./session");

  const sock = makeWASocket({
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,     // ❌ jangan pakai QR
    shouldIgnoreJid: () => false, // cegah bug
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
    },
    browser: ["Railway", "Chrome", "1.0.0"],
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection } = update;

    if (connection === "open") {
      console.log("✅ Connected! Session tersimpan di ./session");

      if (!sock.authState.creds.registered) {
        try {
          let code = await sock.requestPairingCode(botNumber);
          code = code?.match(/.{1,4}/g)?.join("-") || code;
          console.log(`🔑 Pairing Code untuk ${botNumber}: ${code}`);
        } catch (err) {
          console.error("❌ Gagal request pairing code:", err);
        }
      } else {
        console.log("ℹ️ Akun sudah registered, tidak perlu pairing code lagi.");
      }
    }

    if (connection === "close") {
      console.log("❌ Connection closed. Tunggu Railway restart...");
    }
  });

  sock.ev.on("creds.update", saveCreds);
}

startVerify();
