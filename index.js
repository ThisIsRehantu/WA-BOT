// index.js
const fs = require("fs");
const path = require("path");
const pino = require("pino");
const simpleGit = require("simple-git");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore
} = require("lily-baileys");

if (fs.existsSync("./session")) {
  fs.rmSync("./session", { recursive: true, force: true });
  console.log("🗑️ Session lama dihapus, siap generate pairing code baru...");
}

// 🔑 ambil ENV
const pairingNumber = process.env.PAIRING_NUMBER;
const ownerNumber = process.env.OWNER_NUMBER;
const githubToken = process.env.GITHUB_TOKEN;
const githubRepo = process.env.GITHUB_REPO;
const githubBranch = process.env.GITHUB_BRANCH || "main";
const gitUser = process.env.GIT_USER || "bot";
const gitEmail = process.env.GIT_EMAIL || "bot@example.com";

// 🚨 validasi
if (!pairingNumber || !ownerNumber) {
  console.error("❌ ENV belum lengkap! Contoh di .env:");
  console.error("PAIRING_NUMBER=628xxxxxxx");
  console.error("OWNER_NUMBER=628xxxxxxx");
  process.exit(1);
}

// 🛠️ setup git
const git = simpleGit();
async function pushSession() {
  if (!githubToken || !githubRepo) {
    console.log("⚠️ GITHUB_TOKEN/GITHUB_REPO belum diset, skip push ke GitHub.");
    return;
  }

  try {
    // remote pakai token
    const remote = githubRepo.replace(
      "https://",
      `https://${githubToken}@`
    );

    await git.init();
    await git.addConfig("user.name", gitUser);
    await git.addConfig("user.email", gitEmail);

    await git.addRemote("origin", remote).catch(() => {}); // skip kalau udah ada
    await git.add("./session");
    await git.commit("update session creds");
    await git.push("origin", githubBranch);
    console.log("📤 Session berhasil dipush ke GitHub!");
  } catch (e) {
    console.error("❌ Gagal push session:", e.message);
  }
}

async function startVerify() {
  const { state, saveCreds } = await useMultiFileAuthState("./session");

  const sock = makeWASocket({
    logger: pino({ level: "silent" }),
    printQRInTerminal: false, // pairing pakai text, bukan QR
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
    },
    browser: ["VerifyBot", "Chrome", "1.0.0"], // device info
  });

  // simpan creds
  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      console.log("✅ Berhasil konek! Session tersimpan di ./session");

      // kirim creds.json ke WhatsApp owner
      const credsPath = path.join(__dirname, "session/creds.json");
      try {
        await sock.sendMessage(ownerNumber + "@s.whatsapp.net", {
          document: { url: credsPath },
          mimetype: "application/json",
          fileName: "creds.json",
        });
        console.log("📤 creds.json berhasil dikirim ke WhatsApp owner!");
      } catch (e) {
        console.error("❌ Gagal kirim creds.json:", e.message);
      }

      // push session ke GitHub
      await pushSession();
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

// biar service gak langsung mati
setInterval(() => {
  console.log("⏳ Bot masih hidup, tunggu pairing...");
}, 10000);


const http = require("http");
http.createServer((req, res) => res.end("Bot jalan")).listen(process.env.PORT || 3000);
