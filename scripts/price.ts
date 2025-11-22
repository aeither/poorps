const SHIB_PRICE_ID = '0xf0d57deca57b3da2fe63a493f4c25925fdfd8edf834b20f93e1f84dbd1504d4a';
const url = `https://hermes.pyth.network/v2/updates/price/latest?ids%5B%5D=${SHIB_PRICE_ID}`;

async function main() {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error fetching price data:', error);
  }
}

main();
