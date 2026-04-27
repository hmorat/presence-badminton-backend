const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Configuration de la base de données Supabase
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Configuration du transporteur Outlook
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

// 1. Récupérer les créneaux
app.get('/api/creneaux', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM creneaux ORDER BY jour, horaire');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Récupérer les joueurs d'un créneau avec leur état de présence
app.get('/api/joueurs', async (req, res) => {
  const { creneau, date } = req.query;
  try {
    const result = await pool.query(`
      SELECT j.licence, j.nom, j.prenom, j.courrier,
             COALESCE(p.present, false) as present
      FROM joueurs j
      JOIN joueurs_creneaux jc ON j.licence = jc.licence
      LEFT JOIN presences p ON j.licence = p.licence AND p.date_seance = $2
      WHERE jc.creneau_code = $1
      ORDER BY j.nom ASC
    `, [creneau, date]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Enregistrer les présences
app.post('/api/presences', async (req, res) => {
  const { creneau, date, joueurs } = req.body;
  try {
    for (let j of joueurs) {
      await pool.query(`
        INSERT INTO presences (licence, date_seance, creneau_code, present)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (licence, date_seance) 
        DO UPDATE SET present = EXCLUDED.present
      `, [j.licence, date, creneau, j.present]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Export Global
app.get('/api/export-global', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.creneau_code, p.date_seance, j.nom, j.prenom, p.present
      FROM presences p
      JOIN joueurs j ON p.licence = j.licence
      ORDER BY p.date_seance DESC, j.nom ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. ENVOI D'EMAIL AU CRÉNEAU
app.post('/api/send-email', async (req, res) => {
  const { creneau, objet, message } = req.body;
  try {
    const result = await pool.query(`
      SELECT j.courrier 
      FROM joueurs j
      JOIN joueurs_creneaux jc ON j.licence = jc.licence
      WHERE jc.creneau_code = $1 AND j.courrier IS NOT NULL
    `, [creneau]);

    const emails = result.rows.map(r => r.courrier).filter(e => e && e.includes('@'));

    if (emails.length === 0) {
      return res.status(404).json({ error: "Aucun email trouvé pour ce créneau." });
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      bcc: emails.join(','), // Cache les adresses entre les joueurs
      subject: objet,
      text: message
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: `Email envoyé à ${emails.length} joueurs.` });
  } catch (err) {
    console.error("Erreur Mail:", err);
    res.status(500).json({ error: "Erreur lors de l'envoi via Outlook." });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));