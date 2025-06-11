const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

router.get('/', async (req, res) => {
  const query = req.query.name;
  if (!query) {
    return res.render('home', {
      title: 'Drug and Patent Search',
      error: 'Please enter a drug trade name or ingredient'
    });
  }

  // Step 1: Find all Appl_No for the trade name or ingredient
  const productsPath = path.join(__dirname, '../orange_book/products.txt');
  const productsData = fs.readFileSync(productsPath, 'utf8').split('\n').filter(Boolean);
  const header = productsData[0].split('~');
  const tradeNameIdx = header.findIndex(h => h.trim().toLowerCase() === 'trade_name');
  const ingredientIdx = header.findIndex(h => h.trim().toLowerCase() === 'ingredient');
  const applNoIdx = header.findIndex(h => h.trim().toLowerCase() === 'appl_no');

  // Find all Appl_No for either trade name or ingredient match (case-insensitive, trimmed)
  let applNos = productsData.slice(1)
    .map(line => line.split('~'))
    .filter(cols =>
      (cols[tradeNameIdx] && cols[tradeNameIdx].trim().toLowerCase() === query.trim().toLowerCase()) ||
      (cols[ingredientIdx] && cols[ingredientIdx].trim().toLowerCase() === query.trim().toLowerCase())
    )
    .map(cols => cols[applNoIdx] ? cols[applNoIdx].trim().replace(/^0+/, '') : '')
    .filter(applNo => applNo);

  // Remove duplicate Appl_No values
  applNos = [...new Set(applNos)];

  if (applNos.length === 0) {
    return res.render('patent', {
      title: `Patents for ${query}`,
      searchTerm: query,
      applNos: [],
      patents: [],
      error: 'No NDA (Appl_No) found for this trade name or ingredient'
    });
  }

  // Step 2: Find patents for these Appl_No values
  const patentPath = path.join(__dirname, '../orange_book/patent.txt');
  const patentData = fs.readFileSync(patentPath, 'utf8').split('\n').filter(Boolean);
  const patentHeader = patentData[0].split('~');
  const patentApplNoIdx = patentHeader.findIndex(h => h.trim().toLowerCase() === 'appl_no');

  const patentsRaw = patentData.slice(1)
    .map(line => line.split('~'))
    .filter(cols =>
      cols[patentApplNoIdx] &&
      applNos.includes(cols[patentApplNoIdx].trim().replace(/^0+/, ''))
    )
    .map(cols => {
      const obj = {};
      patentHeader.forEach((h, i) => {
        obj[h.replace(/\s+/g, '')] = cols[i];
      });
      return obj;
    });

  // Remove duplicate Patent_No values
  const seenPatentNos = new Set();
  const patents = patentsRaw.filter(patent => {
    const patentNo = patent.Patent_No;
    if (!patentNo || seenPatentNos.has(patentNo)) return false;
    seenPatentNos.add(patentNo);
    return true;
  });

  res.render('patent', {
    title: `Patents for ${query}`,
    searchTerm: query,
    applNos,
    patents
  });
});

module.exports = router;