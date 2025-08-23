// index.js (khusus verifikasi & backup)
const fs = require("fs");
const path = require("path");
const pino = require("pino");
const simpleGit = require("simple-git");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
} = require("lily-baileys");

const botNumber = process.env.PAIRING_NUMBER; // nomor untuk pairing
const ownerNumber = process.env.OWNER_NUMBER; // nomor owner buat kirim creds.json
if (!botNumber || !ownerNumber) {
  console.error("❌ ENV belum lengkap. Contoh:");
  console.error("PAIRING_NUMBER=628xxxxxxx OWNER_NUMBER=628xxxxxxx");
  process.exit(1);
}

// 🗑️ auto hapus session lama
const sessionPath = "./session";
if (fs.existsSync(sessionPath)) {
  fs.rmSync(sessionPath, { recursive: true, force: true });
  console.log("🗑️ Session lama dihapus, siap generate pairing code baru...");
}

// fungsi auto push ke GitHub
const git = simpleGit();
async function pushSession() {
  try {
    await git.add("./session");
    await git.commit("update session creds");
    await git.push("origin", "main");
    console.log("📤 Session berhasil di-push ke GitHub!");
  } catch (err) {
    console.error("❌ Gagal push session:", err.message);
  }
}

async function startVerify() {
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

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
    const { connection } = update;

    if (connection === "open") {
      console.log("✅ Connected! Session baru dibuat di ./session");

      // 🔑 minta pairing code kalau belum register
      if (!sock.authState.creds.registered) {
        try {
          setTimeout(async () => {
            let code = await sock.requestPairingCode(botNumber);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            console.log(`🔑 Pairing Code untuk ${botNumber}: ${code}`);
          }, 2000); // kasih delay 2 detik
        } catch (err) {
          console.error("❌ Gagal request pairing code:", err.message);
        }
      } else {
        console.log("ℹ️ Akun sudah registered, tidak perlu pairing ulang.");
      }

      // kirim creds.json ke WhatsApp owner
      const credsPath = path.join(__dirname, "session/creds.json");
      try {
        await sock.sendMessage(ownerNumber + "@s.whatsapp.net", {
          document: { url: credsPath },
          mimetype: "application/json",
          fileName: "creds.json",
        });
        console.log("📤 creds.json dikirim ke WhatsApp owner!");
      } catch (e) {
        console.error("❌ Gagal kirim creds.json:", e.message);
      }

      // push session ke GitHub
      await pushSession();
    }

    if (connection === "close") {
      console.log("❌ Connection closed. Restart untuk pairing ulang...");
    }
  });

  sock.ev.on("creds.update", saveCreds);
}

startVerify();
