const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(cors());
app.use(express.json());

// 1. Liste des créneaux (Triée par jour puis code)
app.get('/api/creneaux', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM creneaux 
      ORDER BY 
        CASE 
          WHEN jour = 'LUNDI' THEN 1
          WHEN jour = 'MARDI' THEN 2
          WHEN jour = 'MERCREDI' THEN 3
          WHEN jour = 'JEUDI' THEN 4
          WHEN jour = 'VENDREDI' THEN 5
          WHEN jour = 'SAMEDI' THEN 6
          WHEN jour = 'DIMANCHE' THEN 7
        END, 
        creneau_code ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json([]); // On renvoie un tableau vide en cas d'erreur pour éviter le crash front
  }
});

// 2. Liste des joueurs (Correction de la jointure SQL)
app.get('/api/joueurs', async (req, res) => {
  try {
    const { creneau } = req.query; 

    if (!creneau) return res.json([]);

    // On utilise les alias : s pour seances, c pour creneaux
    // On lie s.creneau_id (dans seances) à c.id (dans creneaux)
    const query = `
      SELECT s.* FROM seances s
      INNER JOIN creneaux c ON s.creneau_id = c.id
      WHERE c.creneau_code = $1
      ORDER BY s.entraineur ASC
    `;

    const result = await pool.query(query, [creneau]);
    
    // IMPORTANT : Toujours renvoyer un tableau, même vide
    res.json(result.rows || []);
    
  } catch (err) {
    console.error("ERREUR SQL:", err.message);
    // En cas d'erreur, on renvoie un tableau vide [] au lieu d'une erreur 500
    // C'est ce qui empêchera l'écran de devenir blanc !
    res.json([]); 
  }
});

app.listen(port, () => {
  console.log(`Serveur démarré sur le port ${port}`);
});