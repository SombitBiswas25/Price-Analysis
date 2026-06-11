const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const serverless = require('serverless-http');

const app = express();

app.use(cors());
app.use(express.json());

// Common user-agent to bypass scraping protection
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const tickers = {
  gold: 'GC=F',
  silver: 'SI=F',
  usdinr: 'INR=X',
  petrol: 'RB=F'
};

const rangeMap = {
  '1d': { range: '1d', interval: '15m' },
  '1w': { range: '5d', interval: '1h' },
  '1m': { range: '1mo', interval: '1d' },
  '1y': { range: '1y', interval: '1wk' }
};

const basePrices = {
  gold: 4082.81,
  silver: 63.57,
  petrol: 2.45,
  usdinr: 95.76
};
const prevCloses = {
  gold: 4095.00,
  silver: 64.20,
  petrol: 2.48,
  usdinr: 95.68
};

function generateFallbackData(key, timeframe) {
  const base = basePrices[key];
  const prev = prevCloses[key];
  const change = base - prev;
  const percentChange = (change / prev) * 100;

  const history = [];
  const now = Date.now();
  let pointsCount = 30;
  let timeStep = 24 * 60 * 60 * 1000; // 1 day in ms

  if (timeframe === '1d') {
    pointsCount = 24;
    timeStep = 60 * 60 * 1000; // 1 hour
  } else if (timeframe === '1w') {
    pointsCount = 7;
    timeStep = 24 * 60 * 60 * 1000;
  } else if (timeframe === '1y') {
    pointsCount = 52;
    timeStep = 7 * 24 * 60 * 60 * 1000; // 1 week
  }

  for (let i = pointsCount; i >= 0; i--) {
    const time = now - (i * timeStep);
    // Mock fluctuation
    const factor = 1 + (Math.sin(i * 0.4) * 0.012) + (Math.cos(i * 0.15) * 0.006) - (i * 0.0001);
    history.push({
      time,
      price: base * factor
    });
  }

  return {
    key,
    symbol: tickers[key],
    currency: key === 'usdinr' ? 'INR' : 'USD',
    currentPrice: base,
    previousClose: prev,
    change,
    percentChange,
    history
  };
}

// Router for serverless paths (Netlify rewrites /api/* to this function)
const router = express.Router();

router.get('/commodities', async (req, res) => {
  const timeframe = req.query.timeframe || '1m';
  const { range, interval } = rangeMap[timeframe] || rangeMap['1m'];

  try {
    const fetchPromises = Object.entries(tickers).map(async ([key, ticker]) => {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=${range}&interval=${interval}`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json'
        },
        timeout: 4000
      });
      
      const chartData = response.data.chart.result[0];
      const meta = chartData.meta;
      const timestamps = chartData.timestamp || [];
      const quote = chartData.indicators.quote[0];
      const closePrices = quote.close || [];

      const dataPoints = timestamps.map((timestamp, index) => ({
        time: timestamp * 1000,
        price: closePrices[index]
      })).filter(point => point.price !== null && point.price !== undefined);

      const latestPrice = meta.regularMarketPrice;
      const prevClose = meta.chartPreviousClose || latestPrice;
      const change = latestPrice - prevClose;
      const percentChange = (change / prevClose) * 100;

      return {
        key,
        symbol: meta.symbol,
        currency: meta.currency,
        currentPrice: latestPrice,
        previousClose: prevClose,
        change,
        percentChange,
        history: dataPoints
      };
    });

    const results = await Promise.all(fetchPromises);
    const commodities = results.reduce((acc, current) => {
      acc[current.key] = current;
      return acc;
    }, {});

    res.json(commodities);
  } catch (error) {
    console.warn('Error fetching commodities from API, returning mock/fallback data:', error.message);
    const commodities = {};
    Object.keys(tickers).forEach(key => {
      commodities[key] = generateFallbackData(key, timeframe);
    });
    res.json(commodities);
  }
});

router.get('/petrol', async (req, res) => {
  const fallbackPrices = [
    { city: 'New Delhi', price: 102.12, change: '0.00' },
    { city: 'Kolkata', price: 113.47, change: '0.00' },
    { city: 'Mumbai', price: 111.18, change: '0.00' },
    { city: 'Chennai', price: 107.87, change: '+0.12' },
    { city: 'Gurgaon', price: 102.80, change: '-0.04' },
    { city: 'Noida', price: 102.12, change: '0.00' },
    { city: 'Bangalore', price: 102.84, change: '0.00' },
    { city: 'Hyderabad', price: 109.66, change: '0.00' }
  ];

  try {
    const url = 'https://www.goodreturns.in/petrol-price.html';
    const response = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const table = $('table.gr-table').first();
    const rows = table.find('tbody tr');
    const scrapedPrices = [];

    rows.each((i, row) => {
      const cols = $(row).find('td');
      if (cols.length >= 3) {
        const cityName = $(cols[0]).find('a').text().trim() || $(cols[0]).text().trim();
        const priceText = $(cols[1]).text().trim();
        const priceVal = parseFloat(priceText.replace(/[^\d.]/g, ''));
        const changeText = $(cols[2]).text().trim();

        if (cityName && priceVal) {
          scrapedPrices.push({
            city: cityName,
            price: priceVal,
            change: changeText
          });
        }
      }
    });

    if (scrapedPrices.length > 0) {
      return res.json({ source: 'live', prices: scrapedPrices });
    }
    res.json({ source: 'fallback', prices: fallbackPrices });
  } catch (error) {
    console.error('Error scraping petrol prices, using fallback data:', error.message);
    res.json({ source: 'fallback', prices: fallbackPrices, error: error.message });
  }
});

// Mount router under /api
app.use('/api', router);

// Export serverless handler
module.exports.handler = serverless(app);
