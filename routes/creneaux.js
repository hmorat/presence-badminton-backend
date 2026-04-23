const express = require('express');
const router = express.Router();
const supabase = require('../db'); // Vérifie que ce chemin est correct

router.get('/', async (req, res) => {
  try {
    // On demande explicitement TOUTES les colonnes (*)
    const { data, error } = await supabase
      .from('creneaux')
      .select('*'); 

    if (error) {
        console.error("Erreur Supabase:", error);
        throw error;
    }
    
    // On force l'envoi du JSON
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;