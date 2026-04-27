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

const transporter = nodemailer.createTransport({
  host: "smtp.office365.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: { ciphers: 'SSLv3', rejectUnauthorized: false }
});

// 1. RÉCUPÉRER LES CRÉNEAUX (Avec entraineur et tri correct)
app.get('/api/creneaux', async (req, res) => {
  try {
    // On sélectionne bien TOUTES les colonnes (*) pour avoir l'entraineur
    const result = await pool.query(`
      SELECT * FROM creneaux 
      ORDER BY LENGTH(creneau_code) ASC, creneau_code ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. RÉCUPÉRER LES JOUEURS (Version la plus permissive possible)
app.get('/api/joueurs', async (req, res) => {
  const { creneau, date } = req.query;
  if (!creneau || !date) return res.json([]);
  
  try {
    // On utilise ILIKE au lieu de = pour ignorer les majuscules/minuscules
    // et on garde le TRIM pour les espaces.
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
      WHERE jc.creneau_code ILIKE TRIM($1)
      ORDER BY j.nom ASC
    `, [creneau, date]);
    
    res.json(result.rows);
  } catch (err) {
    console.error("Erreur SQL joueurs:", err);
    res.status(500).json([]);
  }
});

// 3. ENREGISTRER PRÉSENCES
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
    res.status(500).json({ error: err.message });
  }
});

// 4. EMAIL
app.post('/api/send-email', async (req, res) => {
  const { creneau, objet, message } = req.body;
  try {
    const result = await pool.query(`
      SELECT j.courrier FROM joueurs j
      JOIN joueurs_creneaux jc ON TRIM(j.licence::TEXT) = TRIM(jc.licence::TEXT)
      WHERE jc.creneau_code ILIKE TRIM($1) AND j.courrier IS NOT NULL
    `, [creneau]);
    const emails = result.rows.map(r => r.courrier?.trim()).filter(e => e && e.includes('@'));
    if (emails.length === 0) return res.status(404).json({ error: "Pas d'emails" });
    await transporter.sendMail({ from: process.env.EMAIL_USER, bcc: emails.join(','), subject: objet, text: message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Port ${PORT}`));