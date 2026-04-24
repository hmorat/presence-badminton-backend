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

// ROUTE 1 : Les créneaux triés proprement
app.get('/api/creneaux', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM creneaux 
      ORDER BY 
        CASE 
          WHEN jour = 'LUNDI' THEN 1 WHEN jour = 'MARDI' THEN 2
          WHEN jour = 'MERCREDI' THEN 3 WHEN jour = 'JEUDI' THEN 4
          WHEN jour = 'VENDREDI' THEN 5 WHEN jour = 'SAMEDI' THEN 6
          WHEN jour = 'DIMANCHE' THEN 7
        END ASC, creneau_code ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json([]);
  }
});

// ROUTE 2 : Les joueurs (Liste globale OU par date)
app.get('/api/joueurs', async (req, res) => {
  try {
    const { creneau, date } = req.query;
    if (!creneau) return res.json([]);

    // 1. D'abord, on récupère la liste "théorique" (tous les inscrits du créneau)
    // On a besoin de cette base même pour une séance existante
    const queryInscrits = `
      SELECT j.nom, j.prenom, j.licence 
      FROM joueurs_creneaux jc
      JOIN joueurs j ON jc.licence = j.licence
      WHERE jc.creneau_code = $1
      ORDER BY j.nom ASC, j.prenom ASC
    `;
    const inscritsResult = await pool.query(queryInscrits, [creneau]);
    const listeInscrits = inscritsResult.rows;

    if (date && date !== "") {
      // 2. Si une date est sélectionnée, on va chercher les "pointages" dans la table seances
      const queryPointages = `
        SELECT licence, presence 
        FROM seances 
        WHERE creneau_code = $1 AND date_seance = $2
      `;
      const pointagesResult = await pool.query(queryPointages, [creneau, date]);
      const pointages = pointagesResult.rows;

      // 3. On fusionne les deux : on prend tous les inscrits et on leur 
      // rajoute leur statut (présent/absent) s'il existe dans la table seances
      const joueursAvecStatut = listeInscrits.map(joueur => {
        const pointage = pointages.find(p => p.licence === joueur.licence);
        return {
          ...joueur,
          presence: pointage ? pointage.presence : null, // null si pas encore pointé
          date_seance: date
        };
      });

      res.json(joueursAvecStatut);
    } else {
      // Si pas de date, on renvoie juste la liste des inscrits (tous à "null")
      res.json(listeInscrits);
    }
  } catch (err) {
    console.error("Erreur SQL:", err.message);
    res.json([]);
  }
});


app.listen(port, () => console.log(`Serveur prêt sur le port ${port}`));