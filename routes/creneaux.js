const express = require('express');
const router = express.Router();
const supabase = require('../db');

router.get('/', async (req, res) => {
  try {
    // On ne demande que les colonnes qui fonctionnent
    const { data, error } = await supabase
      .from('creneaux')
      .select('creneau_code, Jour, Horaire'); 

    if (error) throw error;
    res.json(data || []); 
  } catch (err) {
    console.error(err);
    res.status(500).json([]); 
  }
});

module.exports = router;