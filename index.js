// index.js
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
} = require("lily-baileys");

const botNumber = process.env.PAIRING_NUMBER; // nomor WA dari ENV
if (!botNumber) {
  console.error("❌ PAIRING_NUMBER env belum di set. Contoh: PAIRING_NUMBER=6281234567890");
  process.exit(1);
}

async function startVerify() {
  const { state, saveCreds } = await useMultiFileAuthState("./session");

  const sock = makeWASocket({
    logger: pino({ level: "silent" }),
    printQRInTerminal: false, // Railway gak bisa scan QR, jadi pairing code
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
    },
    browser: ["Railway", "Chrome", "1.0.0"],
  });

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "open") {
      console.log("✅ Connected! Session tersimpan di ./session");
    }
    if (connection === "close") {
      console.log("❌ Connection closed:", lastDisconnect?.error);
    }
  });

  sock.ev.on("creds.update", saveCreds);

  // kalau akun belum register, request pairing code
  if (!sock.authState.creds.registered) {
    try {
      let code = await sock.requestPairingCode(botNumber);
      code = code?.match(/.{1,4}/g)?.join("-") || code;
      console.log(`🔑 Pairing Code untuk ${botNumber}: ${code}`);
    } catch (err) {
      console.error("❌ Gagal request pairing code:", err);
    }
  }
}

startVerify();
