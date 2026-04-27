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

// --- ROUTES ---

// 1. Récupérer les créneaux (Tri naturel et toutes les colonnes)
app.get('/api/creneaux', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM creneaux 
      ORDER BY LENGTH(creneau_code) ASC, creneau_code ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Récupérer les joueurs (Jointure forcée et insensible à la casse)
app.get('/api/joueurs', async (req, res) => {
  const { creneau, date } = req.query;
  try {
    // Utilisation de COALESCE pour gérer les colonnes avec ou sans majuscule (Nom vs nom)
    // Utilisation de TRIM pour les espaces invisibles
    const result = await pool.query(`
      SELECT 
        COALESCE(j.licence, j."Licence") as licence, 
        COALESCE(j.nom, j."Nom") as nom, 
        COALESCE(j.prenom, j."Prenom") as prenom,
        COALESCE(p.present, false) as present
      FROM joueurs j
      INNER JOIN joueurs_creneaux jc ON TRIM(COALESCE(j.licence, j."Licence")::TEXT) = TRIM(COALESCE(jc.licence, jc."Licence")::TEXT)
      LEFT JOIN presences p ON TRIM(COALESCE(j.licence, j."Licence")::TEXT) = TRIM(p.licence::TEXT) AND p.date_seance = $2
      WHERE jc.creneau_code ILIKE TRIM($1) OR jc."creneau_code" ILIKE TRIM($1)
      ORDER BY 2 ASC
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
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Serveur sur port ${PORT}`));