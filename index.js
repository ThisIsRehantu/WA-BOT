// index.js (khusus verifikasi)
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
} = require("lily-baileys");

const botNumber = process.env.PAIRING_NUMBER;
if (!botNumber) {
  console.error("❌ PAIRING_NUMBER env belum di set. Contoh: PAIRING_NUMBER=6281234567890");
  process.exit(1);
}

async function startVerify() {
  const { state, saveCreds } = await useMultiFileAuthState("./session");

  const sock = makeWASocket({
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
    },
    browser: ["Railway", "Chrome", "1.0.0"],
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      console.log("✅ Connected! Session tersimpan di ./session");

      // baru request pairing code disini
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

    if (connection === "close") {
      console.log("❌ Connection closed:", lastDisconnect?.error);
    }
  });

  sock.ev.on("creds.update", saveCreds);
}

startVerify();
