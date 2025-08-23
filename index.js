// index.js
const fs = require("fs");
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore
} = require("lily-baileys");

const pairingNumber = process.env.PAIRING_NUMBER; // nomor WA yang mau dipair
if (!pairingNumber) {
  console.error("❌ ENV PAIRING_NUMBER belum di set! Contoh: PAIRING_NUMBER=6281234567890");
  process.exit(1);
}

async function startVerify() {
  const { state, saveCreds } = await useMultiFileAuthState("./session");

  const sock = makeWASocket({
    logger: pino({ level: "silent" }),
    printQRInTerminal: false, // gak pakai QR
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
    },
    browser: ["VerifyBot", "Chrome", "1.0.0"], // info device
  });

  // simpan creds
  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      console.log("✅ Berhasil konek! Session tersimpan di ./session");
    }
    if (connection === "close") {
      console.log("❌ Connection closed:", lastDisconnect?.error?.message || lastDisconnect?.error);
    }
  });

  // kalau akun belum register → minta pairing code (text, bukan QR)
  if (!sock.authState.creds.registered) {
    try {
      let code = await sock.requestPairingCode(pairingNumber);
      code = code?.match(/.{1,4}/g)?.join("-") || code; // format 1234-5678
      console.log(`🔑 Pairing Code untuk ${pairingNumber}: ${code}`);
      console.log("👉 Masukkan code ini di WhatsApp untuk verifikasi.");
    } catch (err) {
      console.error("❌ Gagal request pairing code:", err.message);
    }
  }
}

startVerify();
