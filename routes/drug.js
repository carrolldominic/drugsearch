const express = require('express');

const router = express.Router();


// Drug Route
router.get('/', async (req, res) => {
  const drugName = req.query.name;
  if (!drugName) {
    return res.render('home', {
      title: 'Drug and Literature Search',
      error: 'Please enter a drug name'
    });
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
          pubchem: {}
        };

        if (drugInfo.genericName !== 'N/A') {
          try {
            const pubchemResponse = await fetch(
              `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(drugInfo.ingredient)}/JSON`
            );
            if (pubchemResponse.ok) {
              const pubchemData = await pubchemResponse.json();
              const props = pubchemData.PC_Compounds?.[0]?.props || [];
              const cid = pubchemData.PC_Compounds?.[0]?.id?.id?.cid || null;

              drugInfo.pubchem = {
                molecularWeight: props.find(prop => prop.urn.label === 'Molecular Weight')?.value?.sval || 'N/A',
                logP: props.find(prop => prop.urn.label === 'Log P')?.value?.fval || 'N/A',
                hydrogenBondDonors: props.find(prop => prop.urn.label === 'Count' && prop.urn.name === 'Hydrogen Bond Donor')?.value?.ival || 'N/A',
                hydrogenBondAcceptors: props.find(prop => prop.urn.label === 'Count' && prop.urn.name === 'Hydrogen Bond Acceptor')?.value?.ival || 'N/A',
                rotatableBonds: props.find(prop => prop.urn.label === 'Count' && prop.urn.name === 'Rotatable Bond')?.value?.ival || 'N/A',
                imageUrl: cid ? `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG?record_type=2d&image_size=large` : 'N/A'
              };
            } else {
              drugInfo.pubchem = { error: 'Unable to fetch chemistry data' };
            }
          } catch (pubchemError) {
            drugInfo.pubchem = { error: 'Unable to fetch chemistry data' };
          }
        }

        return drugInfo;
      }));

      res.render('drug', {
        title: `Drug Results for ${drugName}`,
        drugs,
        searchTerm: drugName
      });
    } else {
      res.render('home', {
        title: 'Drug and Literature Search',
        error: 'No drugs found'
      });
    }
  } catch (error) {
    console.error('Error fetching drug info:', error);
    res.render('home', {
      title: 'Drug and Literature Search',
      error: 'Error fetching drug information'
    });
  }
});

module.exports = router;