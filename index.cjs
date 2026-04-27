const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 1. Liste des créneaux (Tri naturel)
app.get('/api/creneaux', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM creneaux ORDER BY LENGTH(creneau_code), creneau_code ASC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Liste des joueurs (Flexible sur la casse et les espaces)
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

// 3. Enregistrement des présences
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

// 4. Export Global (Toutes les dates, tous les créneaux)
app.get('/api/export-global', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.creneau_code as "Créneau",
        p.date_seance as "Date",
        COALESCE(j.nom, j."Nom") as "Nom",
        COALESCE(j.prenom, j."Prenom") as "Prénom",
        CASE WHEN p.present THEN 'PRÉSENT' ELSE 'ABSENT' END as "Statut"
      FROM presences p
      LEFT JOIN joueurs j ON TRIM(p.licence::TEXT) = TRIM(COALESCE(j.licence, j."Licence")::TEXT)
      ORDER BY p.date_seance DESC, p.creneau_code ASC, "Nom" ASC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Serveur sur port ${PORT}`));