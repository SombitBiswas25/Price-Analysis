// Aura Price Analysis - Frontend Logic

let commodityData = {};
let petrolData = [];
let activeCommodity = 'gold';
let activeTimeframe = '1m';
let chartInstance = null;
let currentUSDINR = 95.76; // Calibrated 2026 exchange rate fallback

// Troy ounce to Grams conversion factor
const TROY_OUNCE_TO_GRAMS = 31.1034768;
const US_GALLON_TO_LITRES = 3.78541178;

// Indian Domestic Retail Factors (Duties + GST + Market Premium)
const GOLD_DOMESTIC_PREMIUM = 1.184; 
const SILVER_DOMESTIC_PREMIUM = 1.198;
const PETROL_DOMESTIC_PREMIUM = 1.70; // Tax + Retailer margin multiplier

// DOM Elements
const goldPriceInrEl = document.getElementById('gold-price-inr');
const goldPriceUsdEl = document.getElementById('gold-price-usd');
const goldChangeEl = document.getElementById('gold-change');
const gold24k10gEl = document.getElementById('gold-24k-10g');
const gold22k10gEl = document.getElementById('gold-22k-10g');

const silverPriceInrEl = document.getElementById('silver-price-inr');
const silverPriceUsdEl = document.getElementById('silver-price-usd');
const silverChangeEl = document.getElementById('silver-change');
const silver1gEl = document.getElementById('silver-1g');
const silver1kgEl = document.getElementById('silver-1kg');

const usdinrPriceInrEl = document.getElementById('usdinr-price-inr');
const usdinrPriceUsdEl = document.getElementById('usdinr-price-usd');
const usdinrChangeEl = document.getElementById('usdinr-change');

const petrolPriceInrEl = document.getElementById('petrol-price-inr');
const petrolChangeEl = document.getElementById('petrol-change');
const citySelectorEl = document.getElementById('city-selector');
const petrolSourceEl = document.getElementById('petrol-source');
const petrolTableBodyEl = document.getElementById('petrol-table-body');

// Initial setup on page load
window.addEventListener('DOMContentLoaded', () => {
  fetchData();
  // Auto-refresh every 5 minutes (300,000 milliseconds)
  setInterval(fetchData, 300000);
});

// Fetch all prices from backend
async function fetchData() {
  setUpdateStatus('Updating rates...');
  try {
    const [commoditiesRes, petrolRes] = await Promise.all([
      fetch(`/api/commodities?timeframe=${activeTimeframe}`),
      fetch('/api/petrol')
    ]);

    if (!commoditiesRes.ok || !petrolRes.ok) {
      throw new Error('API endpoints returned error status');
    }

    commodityData = await commoditiesRes.json();
    const petrolPayload = await petrolRes.json();
    petrolData = petrolPayload.prices;

    // Set active USDINR rate
    if (commodityData.usdinr) {
      currentUSDINR = commodityData.usdinr.currentPrice;
    }

    updateUI();
    setUpdateStatus('Updated Just Now');
  } catch (error) {
    console.error('Error loading data:', error);
    setUpdateStatus('Failed to update. Retrying...');
  }
}

// Set status text
function setUpdateStatus(text) {
  document.getElementById('update-status').innerText = text;
}

// Update the entire user interface
function updateUI() {
  updateCommodityCards();
  updatePetrolCard();
  updatePetrolTable();
  updateTicker();
  renderChart();
  runCalculation();
}

// Format currency helper
function formatINR(val, decimals = 2) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals
  }).format(val);
}

function formatUSD(val, decimals = 2) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals
  }).format(val);
}

// Update tickers at top
function updateTicker() {
  const tickerEl = document.getElementById('live-ticker');
  if (!commodityData.gold || !petrolData.length) return;

  const goldPrice10g = ((commodityData.gold.currentPrice / TROY_OUNCE_TO_GRAMS) * currentUSDINR * GOLD_DOMESTIC_PREMIUM) * 10;
  const silverPriceKg = ((commodityData.silver.currentPrice / TROY_OUNCE_TO_GRAMS) * currentUSDINR * SILVER_DOMESTIC_PREMIUM) * 1000;
  const delPrice = petrolData.find(p => p.city === 'New Delhi')?.price || 102.12;
  const mumPrice = petrolData.find(p => p.city === 'Mumbai')?.price || 111.18;

  tickerEl.innerHTML = `
    <span class="ticker-item">Gold (24K 10g): <span class="price">${formatINR(goldPrice10g, 0)}</span></span>
    <span class="ticker-item">Silver (1kg): <span class="price">${formatINR(silverPriceKg, 0)}</span></span>
    <span class="ticker-item">USD/INR: <span class="price">₹${currentUSDINR.toFixed(2)}</span></span>
    <span class="ticker-item">Delhi Petrol: <span class="price">₹${delPrice.toFixed(2)}</span></span>
    <span class="ticker-item">Mumbai Petrol: <span class="price">₹${mumPrice.toFixed(2)}</span></span>
    <!-- Duplicate items for seamless loop -->
    <span class="ticker-item">Gold (24K 10g): <span class="price">${formatINR(goldPrice10g, 0)}</span></span>
    <span class="ticker-item">Silver (1kg): <span class="price">${formatINR(silverPriceKg, 0)}</span></span>
    <span class="ticker-item">USD/INR: <span class="price">₹${currentUSDINR.toFixed(2)}</span></span>
  `;
}

// Update cards
function updateCommodityCards() {
  const { gold, silver, usdinr } = commodityData;
  if (!gold || !silver || !usdinr) return;

  // 1. Gold calculations
  const goldPriceOzUsd = gold.currentPrice;
  const goldPriceGramUsd = goldPriceOzUsd / TROY_OUNCE_TO_GRAMS;
  const goldPriceGramInr = goldPriceGramUsd * currentUSDINR * GOLD_DOMESTIC_PREMIUM;
  const goldPrice10g24k = goldPriceGramInr * 10;
  const goldPrice10g22k = goldPrice10g24k * (22 / 24);

  goldPriceInrEl.innerText = formatINR(goldPrice10g24k, 0);
  goldPriceUsdEl.innerText = `${formatINR(goldPriceGramInr * TROY_OUNCE_TO_GRAMS, 0)} / oz`;
  setChangeIndicator(goldChangeEl, gold.percentChange);
  gold24k10gEl.innerText = formatINR(goldPrice10g24k, 0);
  gold22k10gEl.innerText = formatINR(goldPrice10g22k, 0);

  // 2. Silver calculations
  const silverPriceOzUsd = silver.currentPrice;
  const silverPriceGramUsd = silverPriceOzUsd / TROY_OUNCE_TO_GRAMS;
  const silverPriceGramInr = silverPriceGramUsd * currentUSDINR * SILVER_DOMESTIC_PREMIUM;
  const silverPrice1kg = silverPriceGramInr * 1000;

  silverPriceInrEl.innerText = formatINR(silverPrice1kg, 0);
  silverPriceUsdEl.innerText = `${formatINR(silverPriceGramInr * TROY_OUNCE_TO_GRAMS, 0)} / oz`;
  setChangeIndicator(silverChangeEl, silver.percentChange);
  silver1gEl.innerText = formatINR(silverPriceGramInr);
  silver1kgEl.innerText = formatINR(silverPrice1kg, 0);

  // 3. USDINR calculations
  const usdinrRate = usdinr.currentPrice;
  usdinrPriceInrEl.innerText = `₹${usdinrRate.toFixed(2)}`;
  usdinrPriceUsdEl.innerText = `₹${usdinrRate.toFixed(2)} per $1 USD`;
  setChangeIndicator(usdinrChangeEl, usdinr.percentChange);
}

// Update Petrol Dropdown & Card
function updatePetrolCard() {
  if (!petrolData || petrolData.length === 0) return;

  // Save current selected city
  const selectedCity = citySelectorEl.value;

  // Prefill city select if empty
  if (citySelectorEl.options.length === 0) {
    citySelectorEl.innerHTML = '';
    petrolData.forEach(item => {
      const option = document.createElement('option');
      option.value = item.city;
      option.text = item.city;
      if (item.city === 'New Delhi') option.selected = true;
      citySelectorEl.appendChild(option);
    });
  }

  updateCityPetrolPrice();
}

function updateCityPetrolPrice() {
  const selectedCityName = citySelectorEl.value || 'New Delhi';
  const cityData = petrolData.find(p => p.city === selectedCityName);

  if (cityData) {
    petrolPriceInrEl.innerText = `₹${cityData.price.toFixed(2)}`;
    petrolChangeEl.innerText = cityData.change;
    
    // Set change indicator class
    petrolChangeEl.className = 'price-change';
    const changeVal = parseFloat(cityData.change);
    if (changeVal > 0) {
      petrolChangeEl.classList.add('positive');
      petrolChangeEl.innerText = `+${cityData.change}`;
    } else if (changeVal < 0) {
      petrolChangeEl.classList.add('negative');
    } else {
      petrolChangeEl.classList.add('neutral');
    }

    if (activeCommodity === 'petrol') {
      renderChart();
    }
  }
}

// Update the full comparison table at the bottom
function updatePetrolTable() {
  if (!petrolData) return;
  petrolTableBodyEl.innerHTML = '';
  
  petrolData.forEach(item => {
    const tr = document.createElement('tr');
    
    const changeClass = parseFloat(item.change) > 0 ? 'positive' : (parseFloat(item.change) < 0 ? 'negative' : 'neutral');
    const changePrefix = parseFloat(item.change) > 0 ? '+' : '';
    
    tr.innerHTML = `
      <td>${item.city}</td>
      <td>₹${item.price.toFixed(2)}</td>
      <td><span class="price-change ${changeClass}">${changePrefix}${item.change}</span></td>
    `;
    petrolTableBodyEl.appendChild(tr);
  });
}

// Setup positive/negative change elements
function setChangeIndicator(el, changePercent) {
  el.className = 'price-change';
  const val = changePercent.toFixed(2);
  if (changePercent > 0) {
    el.classList.add('positive');
    el.innerText = `+${val}%`;
  } else if (changePercent < 0) {
    el.classList.add('negative');
    el.innerText = `${val}%`;
  } else {
    el.classList.add('neutral');
    el.innerText = `0.00%`;
  }
}

// Toggle commodities active state
function selectCommodity(key) {
  activeCommodity = key;
  
  // Update HTML active styles
  document.querySelectorAll('.metric-card').forEach(card => card.classList.remove('active'));
  document.getElementById(`${key}-metric-card`).classList.add('active');

  // Update chart title
  const titleMap = {
    gold: 'Gold Spot Trend Analysis',
    silver: 'Silver Spot Trend Analysis',
    usdinr: 'USD / INR Exchange Rate Trend',
    petrol: 'Retail Petrol Trend Analysis (Global Futures Benchmark)'
  };
  document.getElementById('chart-title').innerText = titleMap[key] || 'Trend Analysis';

  renderChart();
}

// Trigger timeframe shifts
function setTimeframe(tf) {
  activeTimeframe = tf;
  document.querySelectorAll('.chart-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`btn-${tf}`).classList.add('active');
  fetchData(); // reload history for specific timeframe
}

// Renders the historical lines charts using ApexCharts
function renderChart() {
  const dataset = commodityData[activeCommodity];
  if (!dataset || !dataset.history || dataset.history.length === 0) return;

  // Calculate scaling factor for petrol based on selected city price
  let petrolRatio = 1.0;
  if (activeCommodity === 'petrol' && dataset.history.length > 0) {
    const selectedCityName = citySelectorEl.value || 'New Delhi';
    const cityPrice = petrolData.find(p => p.city === selectedCityName)?.price || 102.12;
    const latestPoint = dataset.history[dataset.history.length - 1];
    const latestGlobalInr = (latestPoint.price / US_GALLON_TO_LITRES) * currentUSDINR * PETROL_DOMESTIC_PREMIUM;
    petrolRatio = cityPrice / latestGlobalInr;
  }

  // Chart config themes
  const colorMap = {
    gold: ['#f5bc3f'],
    silver: ['#ccd4de'],
    usdinr: ['#1eaaf1'],
    petrol: ['#11daa1']
  };

  const nameMap = {
    gold: 'Gold Price (INR/10g)',
    silver: 'Silver Price (INR/1kg)',
    usdinr: 'USD/INR Exchange Rate',
    petrol: 'Petrol Price (INR/Litre)'
  };

  const chartData = dataset.history.map(point => {
    let priceInr = point.price;
    if (activeCommodity === 'gold') {
      priceInr = ((point.price / TROY_OUNCE_TO_GRAMS) * currentUSDINR * GOLD_DOMESTIC_PREMIUM) * 10;
    } else if (activeCommodity === 'silver') {
      priceInr = ((point.price / TROY_OUNCE_TO_GRAMS) * currentUSDINR * SILVER_DOMESTIC_PREMIUM) * 1000;
    } else if (activeCommodity === 'petrol') {
      priceInr = ((point.price / US_GALLON_TO_LITRES) * currentUSDINR * PETROL_DOMESTIC_PREMIUM) * petrolRatio;
    }
    return [point.time, parseFloat(priceInr.toFixed(2))];
  });

  const options = {
    series: [{
      name: nameMap[activeCommodity],
      data: chartData
    }],
    chart: {
      type: 'area',
      height: 350,
      background: 'transparent',
      foreColor: '#90a0b7',
      toolbar: {
        show: false
      },
      zoom: {
        enabled: false
      }
    },
    colors: colorMap[activeCommodity],
    dataLabels: {
      enabled: false
    },
    stroke: {
      curve: 'smooth',
      width: 2.5
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.25,
        opacityTo: 0.02,
        stops: [0, 90, 100]
      }
    },
    grid: {
      borderColor: 'rgba(255, 255, 255, 0.05)',
      xaxis: {
        lines: {
          show: false
        }
      },
      yaxis: {
        lines: {
          show: true
        }
      }
    },
    xaxis: {
      type: 'datetime',
      labels: {
        datetimeUTC: false,
        style: {
          fontFamily: 'Inter, sans-serif'
        }
      },
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      }
    },
    yaxis: {
      labels: {
        formatter: function (val) {
          if (activeCommodity === 'usdinr') {
            return '₹' + val.toFixed(2);
          } else if (activeCommodity === 'petrol') {
            return '₹' + val.toFixed(2);
          }
          return '₹' + Math.round(val).toLocaleString('en-IN');
        },
        style: {
          fontFamily: 'Inter, sans-serif'
        }
      }
    },
    tooltip: {
      x: {
        format: activeTimeframe === '1d' ? 'dd MMM hh:mm TT' : 'dd MMM yyyy'
      },
      y: {
        formatter: function (val) {
          if (activeCommodity === 'usdinr') {
            return '₹' + val.toFixed(4);
          } else if (activeCommodity === 'petrol') {
            return '₹' + val.toFixed(2) + ' / Litre';
          }
          return '₹' + Math.round(val).toLocaleString('en-IN') + (activeCommodity === 'gold' ? ' / 10g' : ' / kg');
        }
      },
      theme: 'dark'
    }
  };

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new ApexCharts(document.querySelector("#main-chart"), options);
  chartInstance.render();
}

// Calculator Logic
let activeCalcTab = 'gold';

function switchCalcTab(tab) {
  activeCalcTab = tab;
  document.querySelectorAll('.calc-tab').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`calc-tab-${tab}`).classList.add('active');

  const purityGroup = document.getElementById('purity-group');
  if (tab === 'gold') {
    purityGroup.style.display = 'flex';
  } else {
    purityGroup.style.display = 'none';
  }

  runCalculation();
}

function runCalculation() {
  const weightInput = parseFloat(document.getElementById('calc-weight').value) || 0;
  const resultTitleEl = document.getElementById('calc-result-title');
  const resultValueEl = document.getElementById('calc-result-value');
  const resultInfoEl = document.getElementById('calc-result-info');

  if (!commodityData.gold || !commodityData.silver) return;

  if (activeCalcTab === 'gold') {
    const goldPriceUsd = commodityData.gold.currentPrice;
    const goldPriceGramInr = (goldPriceUsd / TROY_OUNCE_TO_GRAMS) * currentUSDINR * GOLD_DOMESTIC_PREMIUM;
    const puritySelect = parseFloat(document.getElementById('calc-purity').value) || 22;
    
    // Purity adjustment
    const adjustedGramInr = goldPriceGramInr * (puritySelect / 24);
    const finalValue = adjustedGramInr * weightInput;

    resultTitleEl.innerText = `Estimated ${puritySelect}K Gold Price`;
    resultValueEl.innerText = formatINR(finalValue, 0);
    resultValueEl.style.color = 'var(--gold)';
    resultInfoEl.innerText = `Calculated using live Gold rate of ${formatINR(goldPriceGramInr * TROY_OUNCE_TO_GRAMS, 0)}/oz and USD/INR of ₹${currentUSDINR.toFixed(2)}.`;
  } else {
    const silverPriceUsd = commodityData.silver.currentPrice;
    const silverPriceGramInr = (silverPriceUsd / TROY_OUNCE_TO_GRAMS) * currentUSDINR * SILVER_DOMESTIC_PREMIUM;
    const finalValue = silverPriceGramInr * weightInput;

    resultTitleEl.innerText = `Estimated Silver Price`;
    resultValueEl.innerText = formatINR(finalValue, 0);
    resultValueEl.style.color = 'var(--silver)';
    resultInfoEl.innerText = `Calculated using live Silver rate of ${formatINR(silverPriceGramInr * TROY_OUNCE_TO_GRAMS, 0)}/oz and USD/INR of ₹${currentUSDINR.toFixed(2)}.`;
  }
}

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('Service Worker registered successfully:', reg.scope))
      .catch(err => console.error('Service Worker registration failed:', err));
  });
}

// Custom PWA Install Promotion
let deferredPrompt;
const installBtn = document.getElementById('install-pwa-btn');

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  // Stash the event so it can be triggered later.
  deferredPrompt = e;
  // Update UI to show the install button
  if (installBtn) {
    installBtn.style.display = 'flex';
  }
  console.log("'beforeinstallprompt' event was fired.");
});

if (installBtn) {
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    // We've used the prompt, and can't use it again
    deferredPrompt = null;
    // Hide our install button
    installBtn.style.display = 'none';
  });
}

window.addEventListener('appinstalled', (evt) => {
  console.log('Price Analyze was installed successfully!');
  if (installBtn) {
    installBtn.style.display = 'none';
  }
});

