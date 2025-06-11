const express = require('express');
const axios = require('axios');
const fs = require('fs');
const router = express.Router();

// Compound search route
router.get('/search', async (req, res) => {
  const name = req.query.name;
  if (!name) return res.status(400).send('Missing name parameter');
  try {
    const apiUrl = 'https://drugs.ncats.io/api/v1/substances/search';
    const params = {
      q: name,
      top: 10
    };
    const response = await axios.get(apiUrl, { params });
    const data = response.data;

    fs.writeFileSync('log.txt', JSON.stringify(data, null, 2));

    // Helper to extract facet values by name
    function getFacetValues(facets, facetName) {
      const facet = facets.find(f => f.name === facetName);
      return facet ? facet.values.map(v => v.label) : [];
    }

    // Extract relevant facets for display
    const facets = data.facets || [];
    const facetData = {
      Development_Status: getFacetValues(facets, 'Development Status'),
      Approved_By: getFacetValues(facets, 'Approved By'),
      CAS: getFacetValues(facets, 'CAS'),
      FDA_UNII: getFacetValues(facets, 'FDA UNII'),
      INN: getFacetValues(facets, 'INN'),
      RXCUI: getFacetValues(facets, 'RXCUI'),
      USAN: getFacetValues(facets, 'USAN'),
      NCI_THESAURUS: getFacetValues(facets, 'NCI_THESAURUS')
    };

    // Map content to compounds for display, and fetch target relationships
    const compounds = await Promise.all((data.content || []).map(async substance => {
      let targets = [];
      if (substance._relationships && substance._relationships._self) {
        try {
          const relRes = await axios.get(substance._relationships._self);
          const relData = relRes.data;
          targets = (relData.content || [])
            .filter(r => r.label && r.label.startsWith('TARGET->'))
            .map(r => r.label);
        } catch (e) {
          targets = [];
        }
      }
      return {
        uuid: substance.uuid,
        name: substance._name || '',
        substanceClass: substance.substanceClass || '',
        status: substance.status || '',
        approvalID: substance.approvalID || '',
        approvedBy: substance.approvedBy || '',
        definitionType: substance.definitionType || '',
        definitionLevel: substance.definitionLevel || '',
        links: {
          self: substance._self,
          names: substance._names?.href,
          references: substance._references?.href,
          codes: substance._codes?.href,
          relationships: substance._relationships?.href
        },
        targets
      };
    }));

    res.render('compound', { query: name, compounds, facetData });
  } catch (e) {
    res.status(500).send('Error fetching compounds');
  }
});

module.exports = router;
