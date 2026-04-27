const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// --- CONFIGURATION BASE DE DONNÉES ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// --- CONFIGURATION OUTLOOK ---
const transporter = nodemailer.createTransport({
  host: "smtp.office365.com",
  port: 587,
  secure: false, // TLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    ciphers: 'SSLv3',
    rejectUnauthorized: false
  }
});

// --- ROUTES ---

// 1. Récupérer les créneaux avec TRI ALPHANUMÉRIQUE (F1, F2, F10...)
app.get('/api/creneaux', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM creneaux 
      ORDER BY LENGTH(creneau_code) ASC, creneau_code ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Erreur créneaux:", err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Récupérer les joueurs (Correction du lien invisible entre les tables)
app.get('/api/joueurs', async (req, res) => {
  const { creneau, date } = req.query;
  if (!creneau || !date) return res.json([]);
  
  try {
    // Utilisation de TRIM et conversion TEXT pour forcer la correspondance
    const result = await pool.query(`
      SELECT 
        j.licence, 
        j.nom, 
        j.prenom, 
        j.courrier,
        COALESCE(p.present, false) as present
      FROM joueurs j
      JOIN joueurs_creneaux jc ON TRIM(j.licence::TEXT) = TRIM(jc.licence::TEXT)
      LEFT JOIN presences p ON TRIM(j.licence::TEXT) = TRIM(p.licence::TEXT) AND p.date_seance = $2
      WHERE TRIM(jc.creneau_code::TEXT) = TRIM($1::TEXT)
      ORDER BY j.nom ASC
    `, [creneau, date]);
    
    res.json(result.rows);
  } catch (err) {
    console.error("Erreur SQL joueurs:", err);
    res.status(500).json([]);
  }
});

// 3. Enregistrer les présences
app.post('/api/presences', async (req, res) => {
  const { creneau, date, joueurs } = req.body;
  try {
    for (let j of joueurs) {
      await pool.query(`
        INSERT INTO presences (licence, date_seance, creneau_code, present)
        VALUES (TRIM($1::TEXT), $2, TRIM($3::TEXT), $4)
        ON CONFLICT (licence, date_seance) 
        DO UPDATE SET present = EXCLUDED.present
      `, [j.licence, date, creneau, j.present]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Erreur enregistrement:", err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Envoi d'email via Outlook
app.post('/api/send-email', async (req, res) => {
  const { creneau, objet, message } = req.body;
  try {
    const result = await pool.query(`
      SELECT j.courrier 
      FROM joueurs j
      JOIN joueurs_creneaux jc ON TRIM(j.licence::TEXT) = TRIM(jc.licence::TEXT)
      WHERE TRIM(jc.creneau_code::TEXT) = TRIM($1::TEXT) AND j.courrier IS NOT NULL
    `, [creneau]);

    const emails = result.rows
      .map(r => r.courrier?.trim())
      .filter(e => e && e.includes('@'));

    if (emails.length === 0) {
      return res.status(404).json({ error: "Aucun email valide trouvé." });
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      bcc: emails.join(','), // Cache les adresses entre joueurs
      subject: objet,
      text: message
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: `Email envoyé à ${emails.length} joueurs.` });
  } catch (err) {
    console.error("Erreur SMTP Outlook:", err);
    res.status(500).json({ error: "Échec de l'envoi via Outlook." });
  }
});

// 5. Export Global (Optionnel)
app.get('/api/export-global', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.creneau_code, p.date_seance, j.nom, j.prenom, p.present
      FROM presences p
      JOIN joueurs j ON TRIM(p.licence::TEXT) = TRIM(j.licence::TEXT)
      ORDER BY p.date_seance DESC, j.nom ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Serveur prêt sur le port ${PORT}`);
});