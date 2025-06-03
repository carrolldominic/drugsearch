const express = require('express');
const { create } = require('express-handlebars');
const fetch = require('node-fetch');
const path = require('path');

const app = express();

// Configure Handlebars
const hbs = create({
  extname: '.hbs',
  defaultLayout: 'main',
});

app.engine('.hbs', hbs.engine);
app.set('view engine', '.hbs');
app.set('views', path.join(__dirname, 'views')); 
app.use(express.static(path.join(__dirname, 'public'))); 

app.get('/', (req, res) => {
  res.render('home');
});

app.get('/about', (req, res) => {
  res.render('about');
});

app.get('/drug', async (req, res) => {
  const drugName = req.query.name;
  if (!drugName) {
    return res.render('home', { error: 'Please enter a drug name' });
  }

  try {
    const searchTerm = `${encodeURIComponent(drugName)}*`;
    const fdaResponse = await fetch(
      `https://api.fda.gov/drug/label.json?search=openfda.brand_name:${searchTerm}+openfda.generic_name:${searchTerm}&limit=20`
    );
    const fdaData = await fdaResponse.json();

    if (fdaData.results && fdaData.results.length > 0) {
      const drugs = await Promise.all(fdaData.results.map(async (drug) => {
        const drugInfo = {
          brandName: drug.openfda?.brand_name?.[0] || 'N/A',
          genericName: drug.openfda?.generic_name?.[0] || 'N/A',
          ingredient: drug.openfda?.unii?.[0] || 'N/A',
          moa: drug.openfda?.pharm_class_moa?.[0] || 'N/A',
          manufacturer: drug.openfda?.manufacturer_name?.[0] || 'N/A',
          indications: drug.indications_and_usage?.[0] || 'N/A',
          labelLink: drug.openfda?.spl_set_id?.[0] ? 
            `https://nctr-crs.fda.gov/fdalabel/services/spl/set-ids/${drug.openfda.spl_set_id[0]}/spl-doc` : '',
          pdfLink: drug.openfda?.spl_set_id?.[0] ? 
            `https://dailymed.nlm.nih.gov/dailymed/downloadpdffile.cfm?setId=${drug.openfda.spl_set_id[0]}` : '',
          pubchem: {} // Initialize pubchem data object
        };

        // Fetch PubChem data using generic name
        if (drugInfo.genericName !== 'N/A') {
          try {
            const pubchemResponse = await fetch(
              `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(drugInfo.ingredient)}/JSON`
            );
            if (pubchemResponse.ok) {
              const pubchemData = await pubchemResponse.json();
              const props = pubchemData.PC_Compounds?.[0]?.props || [];
              const cid = pubchemData.PC_Compounds?.[0]?.id?.id?.cid || null;

              // Log available Log P properties for debugging
              const logPProps = props.filter(prop => prop.urn.label === 'Log P');
              if (logPProps.length === 0) {
                console.warn(`No Log P property found for ${drugInfo.genericName}`);
              } else {
                console.log(`Log P properties for ${drugInfo.genericName}:`, logPProps.map(p => ({ name: p.urn.name, value: p.value.fval })));
              }

              drugInfo.pubchem = {
                molecularWeight: props.find(prop => prop.urn.label === 'Molecular Weight')?.value?.sval || 'N/A',
                logP: props.find(prop => prop.urn.label === 'Log P')?.value?.fval || 'N/A',
                hydrogenBondDonors: props.find(prop => prop.urn.label === 'Count' && prop.urn.name === 'Hydrogen Bond Donor')?.value?.ival || 'N/A',
                hydrogenBondAcceptors: props.find(prop => prop.urn.label === 'Count' && prop.urn.name === 'Hydrogen Bond Acceptor')?.value?.ival || 'N/A',
                rotatableBonds: props.find(prop => prop.urn.label === 'Count' && prop.urn.name === 'Rotatable Bond')?.value?.ival || 'N/A',
                imageUrl: cid ? `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG?record_type=2d&image_size=large` : 'N/A'
              };
            } else {
              console.error(`PubChem API error for ${drugInfo.genericName}: Status ${pubchemResponse.status}`);
              drugInfo.pubchem = { error: 'Unable to fetch PubChem data' };
            }
          } catch (pubchemError) {
            console.error(`Error fetching PubChem data for ${drugInfo.genericName}:`, pubchemError);
            drugInfo.pubchem = { error: 'Unable to fetch PubChem data' };
          }
        }

        return drugInfo;
      }));

      res.render('drug', { drugs, searchTerm: drugName });
    } else {
      res.render('home', { error: 'No drugs found' });
    }
  } catch (error) {
    console.error('Error fetching drug info:', error);
    res.render('home', { error: 'Error fetching drug information' });
  }
});

// Export for Vercel
module.exports = app;

// Run locally if not in serverless
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`DrugSearch listening on port ${port}`));
}