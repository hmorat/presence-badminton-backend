const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Configuration Outlook
const transporter = nodemailer.createTransport({
  host: "smtp.office365.com",
  port: 587,
  secure: false,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  tls: { ciphers: 'SSLv3', rejectUnauthorized: false }
});

// 1. Créneaux
app.get('/api/creneaux', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM creneaux ORDER BY LENGTH(creneau_code), creneau_code ASC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Joueurs (Version Flexible)
app.get('/api/joueurs', async (req, res) => {
  const { creneau, date } = req.query;
  try {
    const result = await pool.query(`
      SELECT 
        COALESCE(j.licence, j."Licence") as licence, 
        COALESCE(j.nom, j."Nom") as nom, 
        COALESCE(j.prenom, j."Prenom") as prenom,
        COALESCE(p.present, false) as present
      FROM joueurs j
      JOIN joueurs_creneaux jc ON TRIM(COALESCE(j.licence, j."Licence")::TEXT) = TRIM(COALESCE(jc.licence, jc."Licence")::TEXT)
      LEFT JOIN presences p ON TRIM(COALESCE(j.licence, j."Licence")::TEXT) = TRIM(p.licence::TEXT) AND p.date_seance = $2
      WHERE jc.creneau_code ILIKE TRIM($1) OR jc."creneau_code" ILIKE TRIM($1)
      ORDER BY 2 ASC
    `, [creneau, date]);
    res.json(result.rows);
  } catch (err) { res.status(500).json([]); }
});

// 3. Présences
app.post('/api/presences', async (req, res) => {
  const { date, joueurs, creneau } = req.body;
  try {
    for (const j of joueurs) {
      await pool.query(`
        INSERT INTO presences (licence, date_seance, creneau_code, present)
        VALUES (TRIM($1::TEXT), $2, TRIM($3::TEXT), $4)
        ON CONFLICT (licence, date_seance) DO UPDATE SET present = EXCLUDED.present
      `, [j.licence, date, creneau, j.present]);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. Mails (Version Flexible)
app.post('/api/send-email', async (req, res) => {
  const { creneau, objet, message } = req.body;
  try {
    const result = await pool.query(`
      SELECT DISTINCT COALESCE(j.courrier, j."Courrier") as email
      FROM joueurs j
      JOIN joueurs_creneaux jc ON TRIM(COALESCE(j.licence, j."Licence")::TEXT) = TRIM(COALESCE(jc.licence, jc."Licence")::TEXT)
      WHERE (jc.creneau_code ILIKE TRIM($1) OR jc."creneau_code" ILIKE TRIM($1))
      AND (j.courrier IS NOT NULL OR j."Courrier" IS NOT NULL)
    `, [creneau]);
    const emails = result.rows.map(r => r.email?.trim()).filter(e => e && e.includes('@'));
    if (emails.length === 0) return res.status(404).json({ error: "Aucun email trouvé." });
    await transporter.sendMail({ from: process.env.EMAIL_USER, bcc: emails.join(','), subject: objet, text: message });
    res.json({ success: true, count: emails.length });
  } catch (err) { res.status(500).json({ error: "Erreur envoi" }); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Serveur sur port ${PORT}`));