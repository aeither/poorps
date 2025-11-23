import {
	bytesToHex,
	cre,
	encodeCallMsg,
	getNetwork,
	hexToBase64,
	Runner,
	type Runtime,
	TxStatus,
	type CronPayload,
	type HTTPSendRequester,
	ConsensusAggregationByFields
} from '@chainlink/cre-sdk'
import { type Address, decodeFunctionResult, encodeFunctionData, encodeAbiParameters, zeroAddress } from 'viem'
import { z } from 'zod'
import { Liquidator } from '../contracts/abi'
import { BOT_TOKEN, TG_CHAT_ID } from './constants'

const SHIB_PRICE_ID = '0xf0d57deca57b3da2fe63a493f4c25925fdfd8edf834b20f93e1f84dbd1504d4a'
const PEPE_PRICE_ID = '0xd69731a2e74ac1ce884fc3890f7ee324b6deb66147055249568869ed700882e4'
const DEGEN_PRICE_ID = '0x9c93e4a22c56885af427ac4277437e756e7ec403fbc892f975d497383bb33560'

// --- Pyth Interfaces ---
interface PythPrice {
	price: string
	conf: string
	expo: number
	publish_time: number
}

interface PythPriceUpdate {
	id: string
	price: PythPrice
	ema_price: PythPrice
	metadata: {
		slot: number
		proof_available_time: number
		prev_publish_time: number
	}
}

interface PythResponse {
	binary: {
		encoding: string
		data: string[]
	}
	parsed: PythPriceUpdate[]
}

// --- Telegram Interfaces ---
interface TelegramResponse {
	ok: boolean
	result?: any
	description?: string
}

// --- Config ---
const configSchema = z.object({
	schedule: z.string(),
	url: z.string().optional(), // Kept for compatibility, though unused in onchain logic
	priceUrl: z.string(), // New field for Pyth price URL
	evms: z.array(
		z.object({
			liquidatorAddress: z.string(),
			setPositionProxyAddress: z.string(),
			liquidateCollateralProxyAddress: z.string(),
			chainSelectorName: z.string(),
			gasLimit: z.string(),
			senderAddress: z.string(),
		}),
	),
})

type Config = z.infer<typeof configSchema>

// --- Utility ---
const safeJsonStringify = (obj: any): string =>
	JSON.stringify(obj, (_, value) => (typeof value === 'bigint' ? value.toString() : value), 2)

// --- Telegram Logic ---
const sendTelegramMessage = (
	sendRequester: HTTPSendRequester,
	config: { token: string; chatId: string; text: string }
): TelegramResponse => {
	const url = `https://api.telegram.org/bot${config.token}/sendMessage?chat_id=${config.chatId}&text=${encodeURIComponent(config.text)}`

	const response = sendRequester.sendRequest({
		method: 'GET',
		url,
		headers: { 'Accept': 'application/json' }
	}).result()

	if (response.statusCode !== 200) {
		throw new Error(`HTTP request failed with status: ${response.statusCode}`)
	}

	return JSON.parse(Buffer.from(response.body).toString('utf-8'))
}

// --- Pyth Logic ---
const fetchPythPrice = (sendRequester: HTTPSendRequester, config: { url: string; id?: string }): PythResponse => {
	const response = sendRequester.sendRequest({ method: 'GET', url: config.url, headers: { 'Accept': 'application/json' } }).result()

	if (response.statusCode !== 200) {
		throw new Error(`HTTP request failed for ${config.url} with status: ${response.statusCode}`)
	}

	const responseText = Buffer.from(response.body).toString('utf-8')
	const pythResp: PythResponse = JSON.parse(responseText)

	return pythResp
}

const formatPythPrice = (price: string, expo: number): string => {
	const priceNum = Number(price) * Math.pow(10, expo)
	// Format to avoid scientific notation for small numbers if possible, or just standard string
	return priceNum.toLocaleString('en-US', { maximumSignificantDigits: 8 })
}

const getPrice = (runtime: Runtime<Config>): string => {
	const baseUrl = runtime.config.priceUrl
	const priceIds = [
		{ id: SHIB_PRICE_ID, symbol: 'SHIB' },
		{ id: PEPE_PRICE_ID, symbol: 'PEPE' },
		{ id: DEGEN_PRICE_ID, symbol: 'DEGEN' }
	]

	const httpCapability = new cre.capabilities.HTTPClient()
	const results: string[] = []

	for (const { id, symbol } of priceIds) {
		const url = `${baseUrl}/v2/updates/price/latest?ids%5B%5D=${id}`
		runtime.log(`fetching price for ${symbol} from url ${url}`)

		try {
			const pythResponse = httpCapability
				.sendRequest(
					runtime,
					fetchPythPrice,
					ConsensusAggregationByFields<any>({}),
				)({ url, id }) 
				.result()
			
			if (pythResponse.parsed && pythResponse.parsed.length > 0) {
				const priceData = pythResponse.parsed[0].price
				const formattedPrice = formatPythPrice(priceData.price, priceData.expo)
				results.push(`${symbol}: $${formattedPrice}`)
			} else {
				results.push(`${symbol}: Price Unavailable`)
			}

		} catch (e) {
			runtime.log(`Failed to fetch price for ${symbol}: ${e}`)
			results.push(`${symbol}: Error`)
		}
	}

	return results.length > 0 ? results.join('\n') : "Price Unavailable"
}

// --- OnChain Logic ---
const isLiquidatable = (runtime: Runtime<Config>, userAddress: string): boolean => {
	const evmConfig = runtime.config.evms[0]

	if (!evmConfig.liquidatorAddress) {
		throw new Error('Liquidator address is not defined in config')
	}

	const network = getNetwork({
		chainFamily: 'evm',
		chainSelectorName: evmConfig.chainSelectorName,
		isTestnet: true,
	})

	if (!network) {
		throw new Error(`Network not found for chain selector name: ${evmConfig.chainSelectorName}`)
	}

	const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector)

	const callData = encodeFunctionData({
		abi: Liquidator,
		functionName: 'isLiquidatable',
		args: [userAddress as Address],
	})

	const contractCall = evmClient
		.callContract(runtime, {
			call: encodeCallMsg({
				from: zeroAddress,
				to: evmConfig.liquidatorAddress as Address,
				data: callData,
			}),
		})
		.result()

	return decodeFunctionResult({
		abi: Liquidator,
		functionName: 'isLiquidatable',
		data: bytesToHex(contractCall.data),
	})
}

const setPosition = (runtime: Runtime<Config>, userAddress: string): string => {
	const evmConfig = runtime.config.evms[0]

	runtime.log('Setting position to liquidatable')

	const network = getNetwork({
		chainFamily: 'evm',
		chainSelectorName: evmConfig.chainSelectorName,
		isTestnet: true,
	})

	if (!network) {
		throw new Error(`Network not found for chain selector name: ${evmConfig.chainSelectorName}`)
	}

	const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector)

	const encodedPayload = encodeAbiParameters(
		[{ type: 'address' }, { type: 'bool' }, { type: 'uint256' }],
		[userAddress as Address, true, 100n]
	)

	const reportResponse = runtime
		.report({
			encodedPayload: hexToBase64(encodedPayload),
			encoderName: 'evm',
			signingAlgo: 'ecdsa',
			hashingAlgo: 'keccak256',
		})
		.result()

	const resp = evmClient
		.writeReport(runtime, {
			receiver: evmConfig.setPositionProxyAddress,
			report: reportResponse,
			gasConfig: {
				gasLimit: evmConfig.gasLimit,
			},
		})
		.result()

	runtime.log(`Write report (Set Position) transaction succeeded`)

	const txStatus = resp.txStatus

	if (txStatus !== TxStatus.SUCCESS) {
		throw new Error(`Failed to write report: ${resp.errorMessage || txStatus}`)
	}

	let txHash = new Uint8Array(32)
	if (resp.txHash) {
		txHash = new Uint8Array(resp.txHash)
	}

	return bytesToHex(txHash)
}

const liquidateCollateral = (runtime: Runtime<Config>, userAddress: string): string => {
	const evmConfig = runtime.config.evms[0]

	runtime.log('Liquidating collateral')

	const network = getNetwork({
		chainFamily: 'evm',
		chainSelectorName: evmConfig.chainSelectorName,
		isTestnet: true,
	})

	if (!network) {
		throw new Error(`Network not found for chain selector name: ${evmConfig.chainSelectorName}`)
	}

	const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector)

	const encodedPayload = encodeAbiParameters(
		[{ type: 'address' }],
		[userAddress as Address]
	)

	const reportResponse = runtime
		.report({
			encodedPayload: hexToBase64(encodedPayload),
			encoderName: 'evm',
			signingAlgo: 'ecdsa',
			hashingAlgo: 'keccak256',
		})
		.result()

	const resp = evmClient
		.writeReport(runtime, {
			receiver: evmConfig.liquidateCollateralProxyAddress,
			report: reportResponse,
			gasConfig: {
				gasLimit: evmConfig.gasLimit,
			},
		})
		.result()

	runtime.log(`Write report (Liquidate Collateral) transaction succeeded`)

	const txStatus = resp.txStatus

	if (txStatus !== TxStatus.SUCCESS) {
		throw new Error(`Failed to write report: ${resp.errorMessage || txStatus}`)
	}

	let txHash = new Uint8Array(32)
	if (resp.txHash) {
		txHash = new Uint8Array(resp.txHash)
	}

	return bytesToHex(txHash)
}

// --- Main Workflow Logic ---
const processLiquidationAndNotify = (runtime: Runtime<Config>): string => {
	// 1. Get Price
	const price = getPrice(runtime)

	// 2. Check Liquidatable Status
	const targetUser = runtime.config.evms[0].senderAddress
	const liquidatable = isLiquidatable(runtime, targetUser)
	runtime.log(`User ${targetUser} liquidatable status: ${liquidatable}`)

	// 3. Perform Action
	let txHash: string
	let actionDescription: string

	if (!liquidatable) {
		actionDescription = "Creating Position (Set Position)"
		txHash = setPosition(runtime, targetUser)
	} else {
		actionDescription = "Liquidating Collateral"
		txHash = liquidateCollateral(runtime, targetUser)
	}

	// 4. Send Telegram Notification
	const httpCapability = new cre.capabilities.HTTPClient()
	const message = `🚀 *Poorps Update* 🚀\n\n📊 *Prices:*\n${price}\n\n👤 *User:* \`${targetUser}\`\n\n🛠 *Action:* ${actionDescription}\n\n🔗 *Tx Hash:* ${txHash}`

	try {
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
			.result()
		runtime.log(`Telegram Response: ${safeJsonStringify(telegramResponse)}`)
	} catch (e) {
		runtime.log(`Failed to send telegram message: ${e}`)
	}

	return txHash
}

const onCronTrigger = (runtime: Runtime<Config>, payload: CronPayload): string => {
	if (!payload.scheduledExecutionTime) {
		throw new Error('Scheduled execution time is required')
	}

	runtime.log('Running CronTrigger')

	return processLiquidationAndNotify(runtime)
}

const initWorkflow = (config: Config) => {
	const cronTrigger = new cre.capabilities.CronCapability()

	return [
		cre.handler(
			cronTrigger.trigger({
				schedule: config.schedule,
			}),
			onCronTrigger,
		),
	]
}

export async function main() {
	const runner = await Runner.newRunner<Config>({
		configSchema,
	})
	await runner.run(initWorkflow)
}

main()

