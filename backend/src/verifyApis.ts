import dotenv from 'dotenv';
import path from 'path';

// Load environment variables before importing any services
dotenv.config();

import { RapidApiService } from './services/rapidApiService.ts';
import { GoogleShoppingService } from './services/googleShoppingService.ts';
import { FlipkartApiService } from './services/flipkartApiService.ts';

/**
 * Robust Standalone Diagnostic Verification Script
 * Checks credentials, tests concurrent API requests, maps and formats prices,
 * and performs automated comparative calculations across Amazon, Google, and Flipkart.
 */
async function runDiagnostics() {
  const testKeyword = 'iPhone 15';
  console.log('========================================================================');
  console.log('             🛍️  RETAIL METRIC COMPARATIVE API DIAGNOSTICS              ');
  console.log('========================================================================');
  console.log(`Starting read-only diagnostic search across all sources for: "${testKeyword}"...\n`);

  console.log('--------------------------- CONFIG CHECK -------------------------------');
  console.log(`RAPIDAPI_KEY:             ${process.env.RAPIDAPI_KEY ? '✅ Loaded (Private)' : '❌ Not Found'}`);
  console.log(`RAPIDAPI_HOST:            ${process.env.RAPIDAPI_HOST || '❌ Not Found'}`);
  console.log(`GOOGLE_SHOPPING_API_HOST: ${process.env.GOOGLE_SHOPPING_API_HOST || '❌ Not Found'}`);
  console.log(`FLIPKART_API_HOST:        ${process.env.FLIPKART_API_HOST || '❌ Not Found'}`);
  console.log('------------------------------------------------------------------------\n');

  console.log('Connecting to APIs to fetch live indexes (strictly read-only mode)...');

  // Query all three services in parallel in read-only mode (saveToDb = false)
  const [amazonResults, googleResults, flipkartResults] = await Promise.all([
    RapidApiService.searchAndSyncProducts(testKeyword, false).catch(err => {
      console.error(`[Amazon Sync Error] ${err.message}`);
      return [];
    }),
    GoogleShoppingService.searchAndSyncGoogleShopping(testKeyword, false).catch(err => {
      console.error(`[Google Shopping Sync Error] ${err.message}`);
      return [];
    }),
    FlipkartApiService.searchAndSyncFlipkart(testKeyword, false).catch(err => {
      console.error(`[Flipkart Sync Error] ${err.message}`);
      return [];
    })
  ]);

  interface TableRow {
    source: string;
    productName: string;
    price: number;
    currency: string;
    storeName: string;
    originalPrice: number;
    url: string;
    flagged?: string;
  }

  const allOffers: TableRow[] = [];

  // Mapped Amazon Offers
  for (const prod of amazonResults) {
    for (const off of (prod.offers || [])) {
      allOffers.push({
        source: 'Amazon (RapidAPI)',
        productName: prod.name,
        price: off.price,
        currency: 'INR',
        storeName: off.store_name,
        originalPrice: off.original_price,
        url: off.product_url
      });
    }
  }

  // Mapped Google Shopping Offers
  for (const prod of googleResults) {
    for (const off of (prod.offers || [])) {
      allOffers.push({
        source: 'Google Shopping',
        productName: prod.name,
        price: off.price,
        currency: 'INR',
        storeName: off.store_name,
        originalPrice: off.original_price,
        url: off.product_url
      });
    }
  }

  // Mapped Flipkart Offers
  for (const prod of flipkartResults) {
    for (const off of (prod.offers || [])) {
      allOffers.push({
        source: 'Flipkart API',
        productName: prod.name,
        price: off.price,
        currency: 'INR',
        storeName: off.store_name,
        originalPrice: off.original_price,
        url: off.product_url
      });
    }
  }

  if (allOffers.length === 0) {
    console.log('❌ No offers were retrieved from any source. Ensure your API Key and Hosts are valid, or verify mock fallbacks are functioning.');
    return;
  }

  // Calculate Median Price to evaluate for suspiciously low values (under 30%)
  const sortedPrices = allOffers.map(o => o.price).filter(p => p > 0).sort((a, b) => a - b);
  let medianPrice = 0;
  if (sortedPrices.length > 0) {
    const half = Math.floor(sortedPrices.length / 2);
    medianPrice = sortedPrices.length % 2 !== 0 
      ? sortedPrices[half] 
      : (sortedPrices[half - 1] + sortedPrices[half]) / 2.0;
  }

  console.log(`\nMedian offer price calculated across target array: ₹${medianPrice.toLocaleString('en-IN')}\n`);

  // Evaluate and flag offers
  const flaggedOffers: TableRow[] = [];
  const validOffers: TableRow[] = [];

  for (const off of allOffers) {
    if (medianPrice > 0 && off.price < 0.3 * medianPrice) {
      off.flagged = `⚠️ LOW (Under 30% of Median ₹${medianPrice.toLocaleString('en-IN')})`;
      flaggedOffers.push(off);
    } else {
      validOffers.push(off);
    }
  }

  // Print Comparison Table
  console.log('==================================================================================================');
  console.log('                                     LIVE COMPILATION COMPARATIVE TABLE                           ');
  console.log('==================================================================================================');
  console.log(
    ' ' +
    'SOURCE'.padEnd(18) + ' | ' +
    'PRODUCT NAME'.padEnd(30) + ' | ' +
    'PRICE (INR)'.padEnd(12) + ' | ' +
    'CURRENCY'.padEnd(8) + ' | ' +
    'STORE NAME'
  );
  console.log('--------------------------------------------------------------------------------------------------');

  for (const row of validOffers) {
    const truncProduct = row.productName.length > 28 ? row.productName.substring(0, 25) + '...' : row.productName;
    console.log(
      ' ' +
      row.source.padEnd(18) + ' | ' +
      truncProduct.padEnd(30) + ' | ' +
      `₹${row.price.toLocaleString('en-IN')}`.padEnd(12) + ' | ' +
      row.currency.padEnd(8) + ' | ' +
      row.storeName
    );
  }

  if (flaggedOffers.length > 0) {
    console.log('\n==================================================================================================');
    console.log('                                  ⚠️  FLAGGED SUSPICIOUS PRICING OFFERS                           ');
    console.log('==================================================================================================');
    for (const row of flaggedOffers) {
      const truncProduct = row.productName.length > 28 ? row.productName.substring(0, 25) + '...' : row.productName;
      console.log(
        ' ' +
        row.source.padEnd(18) + ' | ' +
        truncProduct.padEnd(30) + ' | ' +
        `₹${row.price.toLocaleString('en-IN')}`.padEnd(12) + ' | ' +
        row.currency.padEnd(8) + ' | ' +
        row.storeName + '\n   --> REASON: ' + row.flagged
      );
    }
  }

  console.log('==================================================================================================');
  console.log('SUCCESS: Diagnostic comparative runs completed with 0 database writes executed.');
  console.log('==================================================================================================\n');
}

runDiagnostics().catch(err => {
  console.error('[CRITICAL DIAGNOSTIC EXCEPTION]', err);
  process.exit(1);
});
