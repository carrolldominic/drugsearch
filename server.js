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
              drugInfo.pubchem = { error: 'Unable to fetch chemistry data' };
            }
          } catch (pubchemError) {
            console.error(`Error fetching PubChem data for ${drugInfo.genericName}:`, pubchemError);
            drugInfo.pubchem = { error: 'Unable to fetch chemistry data' };
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



const ExcelJS = require('exceljs');

app.get('/literature', async (req, res) => {
  const drugName = req.query.name;
  if (!drugName) {
    return res.render('home', { error: 'Please enter a drug name' });
  }

  try {
    const searchTerm = encodeURIComponent(drugName);
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${searchTerm}&retmax=20&retmode=json`;
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    if (!searchData.esearchresult || !searchData.esearchresult.idlist || searchData.esearchresult.idlist.length === 0) {
      return res.render('literature', { searchTerm: drugName, articles: [], error: 'No articles found' });
    }

    const pmids = searchData.esearchresult.idlist.join(',');
    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmids}&retmode=json`;
    const fetchResponse = await fetch(fetchUrl);
    const fetchData = await fetchResponse.json();

    const articles = Object.values(fetchData.result)
      .filter(article => article.uid && article.title)
      .map(article => ({
        title: article.title || 'N/A',
        authors: article.authors?.map(author => author.name).join(', ') || 'N/A',
        journal: article.source || 'N/A',
        pubDate: article.pubdate || 'N/A',
        doi: article.elocationid || 'N/A',
        pmcid: article.articleids?.find(id => id.idtype === 'pmcid')?.value || 'N/A',
        link: `https://pubmed.ncbi.nlm.nih.gov/${article.uid}/`
      }));

    res.render('literature', { searchTerm: drugName, articles });
  } catch (error) {
    console.error('Error fetching PubMed data:', error);
    res.render('literature', { searchTerm: drugName, articles: [], error: 'Error fetching literature data' });
  }
});

app.get('/literature/download', async (req, res) => {
  const drugName = req.query.name;
  if (!drugName) {
    return res.status(400).send('Drug name is required');
  }

  try {
    const searchTerm = encodeURIComponent(drugName);
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${searchTerm}&retmax=20&retmode=json`;
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    if (!searchData.esearchresult || !searchData.esearchresult.idlist || searchData.esearchresult.idlist.length === 0) {
      return res.status(404).send('No articles found');
    }

    const pmids = searchData.esearchresult.idlist.join(',');
    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmids}&retmode=json`;
    const fetchResponse = await fetch(fetchUrl);
    const fetchData = await fetchResponse.json();

    const articles = Object.values(fetchData.result)
      .filter(article => article.uid && article.title)
      .map(article => ({
        title: article.title || 'N/A',
        authors: article.authors?.map(author => author.name).join(', ') || 'N/A',
        journal: article.source || 'N/A',
        pubDate: article.pubdate || 'N/A',
        doi: article.elocationid || 'N/A',
        pmcid: article.articleids?.find(id => id.idtype === 'pmcid')?.value || 'N/A',
        link: `https://pubmed.ncbi.nlm.nih.gov/${article.uid}/`
      }));

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('PubMed Articles');

    // Define columns
    worksheet.columns = [
      { header: 'Title', key: 'title', width: 50 },
      { header: 'Authors', key: 'authors', width: 30 },
      { header: 'Journal', key: 'journal', width: 20 },
      { header: 'Publication Date', key: 'pubDate', width: 15 },
      { header: 'DOI', key: 'doi', width: 20 },
      { header: 'PMCID', key: 'pmcid', width: 15 },
      { header: 'PubMed Link', key: 'link', width: 30 }
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'D3D3D3' }
    };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // Add article data
    articles.forEach(article => {
      worksheet.addRow(article);
    });

    // Set response headers for Excel download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="PubMed_${drugName}_Articles.xlsx"`);

    // Write workbook to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating Excel file:', error);
    res.status(500).send('Error generating Excel file');
  }
});



// Export for Vercel
module.exports = app;

// Run locally if not in serverless
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`DrugSearch listening on port ${port}`));
}