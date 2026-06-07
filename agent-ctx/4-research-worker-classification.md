# Task 4: Research Worker Query Classification & Search Routing

## Agent: Main Agent
## Status: COMPLETED

## Summary
Added query classification and intelligent search routing to the Kivora Research Worker (`/home/z/my-project/research-worker/src/index.js`), upgrading from v4.0.0 to v5.0.0.

## Changes Made

### 1. Query Classification Function (`classifyQuery`)
- Added `CLASSIFICATION_PATTERNS` constant with term lists for 4 categories:
  - **academic**: research, study, paper, journal, effect of, meta-analysis, systematic review, RCT, clinical trial, hypothesis, methodology, DOI, arxiv, peer-reviewed, publication, literature review, empirical, qualitative, quantitative, longitudinal
  - **biomedical**: health, medical, disease, treatment, drug, therapy, diagnosis, symptoms, patient, clinical, pharmaceutical, vaccine, epidemiology, pathology, medicine, hospital, surgery, prognosis, mortality, morbidity
  - **tech**: software, programming, framework, API, library, algorithm, code, developer, deployment, infrastructure, cloud, AI model, machine learning, open source, repository, devops, kubernetes, docker, serverless
  - **finance**: stock, market, investment, revenue, profit, GDP, economy, financial, crypto, bitcoin, trading, portfolio, hedge fund, equity, dividend, fiscal, monetary, inflation, bond, commodity
- Word boundary matching for single terms, substring matching for multi-word phrases
- Biomedical wins over academic when both match (biomedical is more specific)
- Default: `general`

### 2. Academic Search Providers
- **`searchSemanticScholar(query, limit=5)`**: Free API, returns title, url, abstract, year, citationCount, authors, DOI
- **`searchCrossref(query, rows=5)`**: Free API (no key needed), returns title, url, abstract, authors, year, citation count, DOI
- **`searchPubMed(query, retmax=5)`**: Free NCBI E-utilities API (two-step: esearch then esummary), returns title, url, abstract, authors, year, DOI
- **`searchGitHub(query, perPage=5)`**: Free GitHub API (rate-limited to 10 req/min unauthenticated), returns repo name, url, description, owner, stars, year

### 3. Search Routing
- **`searchQuick()`** now accepts `classification` parameter:
  - academic/biomedical → adds Semantic Scholar + Crossref (+ PubMed for biomedical)
  - tech → adds GitHub
  - finance/general → standard providers only
- **`searchDeep()`** now accepts `classification` parameter:
  - Same routing logic as searchQuick, added to the base 3 providers

### 4. Enhanced Source Metadata
- Academic sources (semantic-scholar, crossref, pubmed) include:
  - `authors: string[]`
  - `year: number | null`
  - `citations: number`
  - `doi: string`
  - `sourceType: string`
- GitHub sources include:
  - `authors: string[]` (owner login)
  - `year: number | null`
  - `sourceType: 'github'`

### 5. Classification in Response
- Both `quickResearch()` and `deepResearch()` now include `classification` field in response
- Classification is logged at the start of each research pipeline

### 6. New Endpoints
- **POST `/classify`**: Test endpoint that returns `{ query, classification }` for a given query
- **GET `/debug`**: Updated to show academic_providers and classifications
- **GET `/health`**: Updated version to 5.0.0, includes semantic_scholar, crossref, pubmed, github providers and classifications list

### 7. Version Update
- Bumped from v4.0.0 to v5.0.0

## Backward Compatibility
- All existing functionality is preserved
- The `classification` parameter defaults to `'general'` in search functions
- Response objects are backward compatible (new `classification` field is additive)
- New source metadata fields are only present for academic/tech sources
