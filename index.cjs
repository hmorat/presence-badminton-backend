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

// Test de connexion à la base au démarrage
pool.query('SELECT NOW()', (err) => {
  if (err) console.error("❌ Erreur de connexion DB:", err.message);
  else console.log("✅ Connexion à PostgreSQL réussie");
});

app.get('/api/creneaux', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM creneaux ORDER BY LENGTH(creneau_code), creneau_code ASC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

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
      WHERE jc.creneau_code = $1 OR jc."creneau_code" = $1
      ORDER BY 2 ASC
    `, [creneau, date]);
    res.json(result.rows);
  } catch (err) { res.status(500).json([]); }
});

// SAUVEGARDE AMÉLIORÉE (C'est ici que ça bloquait probablement)
app.post('/api/presences', async (req, res) => {
  const { date, joueurs, creneau } = req.body;
  try {
    for (const j of joueurs) {
      await pool.query(`
        INSERT INTO presences (licence, date_seance, creneau_code, present)
        VALUES (TRIM($1::TEXT), $2, TRIM($3::TEXT), $4)
        ON CONFLICT (licence, date_seance) 
        DO UPDATE SET 
          present = EXCLUDED.present,
          creneau_code = EXCLUDED.creneau_code
      `, [j.licence, date, creneau, j.present]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Détail Erreur DB:", err.message); // Regarde tes logs Render !
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/export-global', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        TO_CHAR(p.date_seance, 'DD/MM/YYYY') as "Date",
        p.creneau_code as "Créneau",
        COALESCE(j.nom, j."Nom") as "Nom",
        COALESCE(j.prenom, j."Prenom") as "Prénom",
        CASE WHEN p.present THEN 'PRÉSENT' ELSE 'ABSENT' END as "Statut"
      FROM presences p
      LEFT JOIN joueurs j ON TRIM(p.licence::TEXT) = TRIM(COALESCE(j.licence, j."Licence")::TEXT)
      ORDER BY p.date_seance DESC, p.creneau_code ASC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Serveur prêt sur port ${PORT}`));