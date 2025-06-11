const express = require('express');
const https = require('https');
const url = require('url');
const handlebars = require('handlebars');

// Register encodeURIComponent helper for Handlebars
handlebars.registerHelper('encodeURIComponent', function(str) {
  return encodeURIComponent(str);
});

const router = express.Router();

// Drug Route
router.get('/', async (req, res) => {
  const drugName = req.query.name;
  const manufacturer = req.query.manufacturer;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = 20;
  const skip = (page - 1) * limit;

  if (!drugName && !manufacturer) {
    return res.render('home', {
      title: 'Drug and Literature Search',
      error: 'Please enter a drug name or manufacturer'
    });
  }

  try {
    let apiUrl = '';
    if (drugName && manufacturer) {
      // Search by both drug name and manufacturer
      apiUrl = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encodeURIComponent(drugName)}"+openfda.manufacturer_name:"${encodeURIComponent(manufacturer)}"&limit=${limit}&skip=${skip}`;
    } else if (drugName) {
      // Search by drug name only
      apiUrl = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encodeURIComponent(drugName)}"+openfda.generic_name:"${encodeURIComponent(drugName)}"&limit=${limit}&skip=${skip}`;
    } else if (manufacturer) {
      // Search by manufacturer only
      apiUrl = `https://api.fda.gov/drug/label.json?search=openfda.manufacturer_name:"${encodeURIComponent(manufacturer)}"&limit=${limit}&skip=${skip}`;
    }

    const fdaResponse = await fetch(apiUrl);
    const fdaData = await fdaResponse.json();

    let total = fdaData.meta?.results?.total || 0;
    let pageCount = Math.ceil(total / limit);

    if (fdaData.results && fdaData.results.length > 0) {
      const drugs = await Promise.all(fdaData.results.map(async (drug) => {
        const drugInfo = {
          brandName: drug.openfda?.brand_name?.[0] || 'N/A',
          genericName: drug.openfda?.generic_name?.[0] || 'N/A',
          ingredient: drug.openfda?.unii?.[0] || 'N/A',
          moa: drug.openfda?.pharm_class_moa?.[0] || 'N/A',
          manufacturer: drug.openfda?.manufacturer_name?.[0] || 'N/A',
          indications: drug.indications_and_usage?.[0] || 'N/A',
          labelLink: drug.openfda?.spl_set_id?.[0]
            ? `https://nctr-crs.fda.gov/fdalabel/services/spl/set-ids/${drug.openfda.spl_set_id[0]}/spl-doc`
            : '',
          pdfLink: drug.openfda?.spl_set_id?.[0]
            ? `https://dailymed.nlm.nih.gov/dailymed/downloadpdffile.cfm?setId=${drug.openfda.spl_set_id[0]}`
            : '',
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
        title: `Drug Results for ${drugName || manufacturer}`,
        drugs,
        searchTerm: drugName || manufacturer,
        page,
        pageCount,
        total,
        drugName,
        manufacturer
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

// Proxy PDF streaming route
router.get('/viewpdf', (req, res) => {
  const pdfUrl = req.query.url;
  if (!pdfUrl) return res.status(400).send('No PDF URL provided');
  // Basic validation to prevent misuse
  const parsed = url.parse(pdfUrl);
  if (!/^https?:$/.test(parsed.protocol)) return res.status(400).send('Invalid URL');

  // Enhanced security: Only allow FDA.gov or NIH.gov domains (including subdomains)
  const allowedDomains = [/\.fda\.gov$/i, /\.nih\.gov$/i];
  const hostname = parsed.hostname || '';
  const isAllowed = allowedDomains.some(re => re.test(hostname));
  if (!isAllowed) return res.status(403).send('PDF proxying only allowed from FDA.gov or NIH.gov domains');

  https.get(pdfUrl, (pdfRes) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="label.pdf"');
    pdfRes.pipe(res);
  }).on('error', () => {
    res.status(500).send('Error fetching PDF');
  });
});

module.exports = router;