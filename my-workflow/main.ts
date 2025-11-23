import {
  ConsensusAggregationByFields,
  type CronPayload,
  cre,
  type HTTPSendRequester,
  Runner,
  type Runtime,
} from '@chainlink/cre-sdk';
import { z } from 'zod';
import { BOT_TOKEN, TG_CHAT_ID } from './constants';

// Define Pyth Response Types
interface PythPrice {
  price: string;
  conf: string;
  expo: number;
  publish_time: number;
}

interface PythPriceUpdate {
  id: string;
  price: PythPrice;
  ema_price: PythPrice;
  metadata: {
    slot: number;
    proof_available_time: number;
    prev_publish_time: number;
  };
}

interface PythResponse {
  binary: {
    encoding: string;
    data: string[];
  };
  parsed: PythPriceUpdate[];
}

interface TelegramResponse {
  ok: boolean;
  result?: any;
  description?: string;
}

const sendTelegramMessage = (
  sendRequester: HTTPSendRequester,
  config: { token: string; chatId: string; text: string }
): TelegramResponse => {
  const url = `https://api.telegram.org/bot${config.token}/sendMessage?chat_id=${config.chatId}&text=${encodeURIComponent(config.text)}`;

  const response = sendRequester.sendRequest({
    method: 'GET',
    url,
    headers: { 'Accept': 'application/json' }
  }).result();

  if (response.statusCode !== 200) {
    throw new Error(`HTTP request failed with status: ${response.statusCode}`);
  }

  return JSON.parse(Buffer.from(response.body).toString('utf-8'));
};

// Define configuration schema
const configSchema = z.object({
  schedule: z.string(),
  url: z.string(),
});

type Config = z.infer<typeof configSchema>;

// Utility function to safely stringify objects with bigints
const safeJsonStringify = (obj: any): string =>
  JSON.stringify(obj, (_, value) => (typeof value === 'bigint' ? value.toString() : value), 2);

const fetchPythPrice = (sendRequester: HTTPSendRequester, config: Config): PythResponse => {
  const response = sendRequester.sendRequest({ method: 'GET', url: config.url, headers: { 'Accept': 'application/json' } }).result();

  if (response.statusCode !== 200) {
    throw new Error(`HTTP request failed with status: ${response.statusCode}`);
  }

  const responseText = Buffer.from(response.body).toString('utf-8');
  const pythResp: PythResponse = JSON.parse(responseText);

  return pythResp;
};

const getPrice = (runtime: Runtime<Config>): string => {
  runtime.log(`fetching price from url ${runtime.config.url}`);

  const httpCapability = new cre.capabilities.HTTPClient();

  const pythResponse = httpCapability
    .sendRequest(
      runtime,
      fetchPythPrice,
      ConsensusAggregationByFields<any>({
        // Define aggregation if needed, for now empty object as we trust the source
      }),
    )(runtime.config)
    .result();

  runtime.log(`Pyth Response: ${safeJsonStringify(pythResponse)}`);
  if (pythResponse.parsed && pythResponse.parsed.length > 0) {
    const priceData = pythResponse.parsed[0].price;
    runtime.log(`SHIB Price: ${priceData.price} (conf: ${priceData.conf}, expo: ${priceData.expo})`);
    return priceData.price;
  }

  return "0";
};

const onCronTrigger = (runtime: Runtime<Config>, payload: CronPayload): string => {
  if (!payload.scheduledExecutionTime) {
    throw new Error('Scheduled execution time is required');
  }

  runtime.log('Running CronTrigger for Price');
  const price = getPrice(runtime);

  // Send Telegram Message
  const httpCapability = new cre.capabilities.HTTPClient();
  const message = `Hello from bot! Price is ${price}`;

  const telegramResponse = httpCapability
    .sendRequest(
      runtime,
      sendTelegramMessage,
      ConsensusAggregationByFields<any>({})
    )({
      token: BOT_TOKEN,
      chatId: TG_CHAT_ID,
      text: message,
    })
    .result();

  runtime.log(`Telegram Response: ${safeJsonStringify(telegramResponse)}`);

  return price;
};

const initWorkflow = (config: Config) => {
  const cron = new cre.capabilities.CronCapability();

  return [
    cre.handler(
      cron.trigger({
        schedule: config.schedule,
      }),
      onCronTrigger,
    ),
  ];
};

export async function main() {
  const runner = await Runner.newRunner<Config>({
    configSchema,
  });
  await runner.run(initWorkflow);
}

main();
