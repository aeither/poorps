import {
	bytesToHex,
	ConsensusAggregationByFields,
	type CronPayload,
	cre,
	type EVMLog,
	encodeCallMsg,
	getNetwork,
	type HTTPSendRequester,
	hexToBase64,
	LAST_FINALIZED_BLOCK_NUMBER,
	median,
	Runner,
	type Runtime,
	TxStatus,
} from '@chainlink/cre-sdk'
import { type Address, decodeFunctionResult, encodeFunctionData, zeroAddress } from 'viem'
import { z } from 'zod'
import { BalanceReader, Counter, IERC20, MessageEmitter, ReserveManager } from '../contracts/abi'

const configSchema = z.object({
	schedule: z.string(),
	url: z.string(),
	evms: z.array(
		z.object({
			tokenAddress: z.string(),
			porAddress: z.string(),
			proxyAddress: z.string(),
			balanceReaderAddress: z.string(),
			messageEmitterAddress: z.string(),
			counterAddress: z.string().optional(),
			chainSelectorName: z.string(),
			gasLimit: z.string(),
			senderAddress: z.string(),
		}),
	),
})

type Config = z.infer<typeof configSchema>

interface PORResponse {
	accountName: string
	totalTrust: number
	totalToken: number
	ripcord: boolean
	updatedAt: string
}

interface ReserveInfo {
	lastUpdated: Date
	totalReserve: number
}

// Utility function to safely stringify objects with bigints
const safeJsonStringify = (obj: any): string =>
	JSON.stringify(obj, (_, value) => (typeof value === 'bigint' ? value.toString() : value), 2)

const fetchReserveInfo = (sendRequester: HTTPSendRequester, config: Config): ReserveInfo => {
	const response = sendRequester.sendRequest({ method: 'GET', url: config.url }).result()

	if (response.statusCode !== 200) {
		throw new Error(`HTTP request failed with status: ${response.statusCode}`)
	}

	const responseText = Buffer.from(response.body).toString('utf-8')
	const porResp: PORResponse = JSON.parse(responseText)

	if (porResp.ripcord) {
		throw new Error('ripcord is true')
	}

	return {
		lastUpdated: new Date(porResp.updatedAt),
		totalReserve: porResp.totalToken,
	}
}

const fetchNativeTokenBalance = (
	runtime: Runtime<Config>,
	evmConfig: Config['evms'][0],
	tokenHolderAddress: string,
): bigint => {
	const network = getNetwork({
		chainFamily: 'evm',
		chainSelectorName: evmConfig.chainSelectorName,
		isTestnet: true,
	})

	if (!network) {
		throw new Error(`Network not found for chain selector name: ${evmConfig.chainSelectorName}`)
	}

	const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector)

	// Encode the contract call data for getNativeBalances
	const callData = encodeFunctionData({
		abi: BalanceReader,
		functionName: 'getNativeBalances',
		args: [[tokenHolderAddress as Address]],
	})

	const contractCall = evmClient
		.callContract(runtime, {
			call: encodeCallMsg({
				from: zeroAddress,
				to: evmConfig.balanceReaderAddress as Address,
				data: callData,
			}),
			blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
		})
		.result()

	// Decode the result
	const balances = decodeFunctionResult({
		abi: BalanceReader,
		functionName: 'getNativeBalances',
		data: bytesToHex(contractCall.data),
	})

	if (!balances || balances.length === 0) {
		throw new Error('No balances returned from contract')
	}

	return balances[0]
}

const getTotalSupply = (runtime: Runtime<Config>): bigint => {
	const evms = runtime.config.evms
	let totalSupply = 0n

	for (const evmConfig of evms) {
		const network = getNetwork({
			chainFamily: 'evm',
			chainSelectorName: evmConfig.chainSelectorName,
			isTestnet: true,
		})

		if (!network) {
			throw new Error(`Network not found for chain selector name: ${evmConfig.chainSelectorName}`)
		}

		const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector)

		// Encode the contract call data for totalSupply
		const callData = encodeFunctionData({
			abi: IERC20,
			functionName: 'totalSupply',
		})

		const contractCall = evmClient
			.callContract(runtime, {
				call: encodeCallMsg({
					from: zeroAddress,
					to: evmConfig.tokenAddress as Address,
					data: callData,
				}),
				blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
			})
			.result()

		// Decode the result
		const supply = decodeFunctionResult({
			abi: IERC20,
			functionName: 'totalSupply',
			data: bytesToHex(contractCall.data),
		})

		totalSupply += supply
	}

	return totalSupply
}

const sendEVMTransaction = (
	runtime: Runtime<Config>,
	evmConfig: Config['evms'][0],
	contractAddress: string,
	abi: any,
	functionName: string,
	args: any[],
	useReport: boolean = true,
): Uint8Array => {
	const network = getNetwork({
		chainFamily: 'evm',
		chainSelectorName: evmConfig.chainSelectorName,
		isTestnet: true,
	})

	if (!network) {
		throw new Error(`Network not found for chain selector name: ${evmConfig.chainSelectorName}`)
	}

	const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector)

	// Encode the contract call data
	const callData = encodeFunctionData({
		abi,
		functionName,
		args,
	})

	let txHash = new Uint8Array(32)

	if (useReport) {
		// Step 1: Generate report using consensus capability
		const reportResponse = runtime
			.report({
				encodedPayload: hexToBase64(callData),
				encoderName: 'evm',
				signingAlgo: 'ecdsa',
				hashingAlgo: 'keccak256',
			})
			.result()

		const resp = evmClient
			.writeReport(runtime, {
				receiver: contractAddress,
				report: reportResponse,
				gasConfig: {
					gasLimit: evmConfig.gasLimit,
				},
			})
			.result()

		runtime.log(`Write report transaction succeeded at txHash: ${JSON.stringify(runtime.config.evms)}`)

		const txStatus = resp.txStatus

		if (txStatus !== TxStatus.SUCCESS) {
			throw new Error(`Failed to write report: ${resp.errorMessage || txStatus}`)
		}

		if (resp.txHash) {
			txHash = new Uint8Array(resp.txHash)
		}

		runtime.log(`Write report transaction succeeded at txHash: ${bytesToHex(txHash)}`)
	}

	return txHash
}

const updateReserves = (
	runtime: Runtime<Config>,
	totalSupply: bigint,
	totalReserveScaled: bigint,
): string => {
	const evmConfig = runtime.config.evms[0]

	runtime.log(
		`Updating reserves totalSupply ${totalSupply.toString()} totalReserveScaled ${totalReserveScaled.toString()}`,
	)

	const txHash = sendEVMTransaction(
		runtime,
		evmConfig,
		evmConfig.proxyAddress,
		ReserveManager,
		'updateReserves',
		[
			{
				totalMinted: totalSupply,
				totalReserve: totalReserveScaled,
			},
		],
	)

	return bytesToHex(txHash)
}

const getCounterValue = (runtime: Runtime<Config>): bigint => {
	const evmConfig = runtime.config.evms[0]

	if (!evmConfig.counterAddress) {
		throw new Error('Counter address is not defined in config')
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
		abi: Counter,
		functionName: 'number',
		args: [],
	})

	const contractCall = evmClient
		.callContract(runtime, {
			call: encodeCallMsg({
				from: zeroAddress,
				to: evmConfig.counterAddress as Address,
				data: callData,
			}),
		})
		.result()

	return decodeFunctionResult({
		abi: Counter,
		functionName: 'number',
		data: bytesToHex(contractCall.data),
	})
}

const incrementCounter = (runtime: Runtime<Config>): string => {
	const evmConfig = runtime.config.evms[0]

	if (!evmConfig.counterAddress) {
		throw new Error('Counter address is not defined in config')
	}

	const counterValue = getCounterValue(runtime)
	runtime.log(`Current Counter Value: ${counterValue.toString()}`)

	runtime.log('Incrementing counter')

	const txHash = sendEVMTransaction(
		runtime,
		evmConfig,
		evmConfig.counterAddress,
		Counter,
		'increment',
		[],
	)

	return bytesToHex(txHash)
}

const doPOR = (runtime: Runtime<Config>): string => {
	runtime.log(`fetching por url ${runtime.config.url}`)

	const httpCapability = new cre.capabilities.HTTPClient()
	const reserveInfo = httpCapability
		.sendRequest(
			runtime,
			fetchReserveInfo,
			ConsensusAggregationByFields<ReserveInfo>({
				lastUpdated: median,
				totalReserve: median,
			}),
		)(runtime.config)
		.result()

	runtime.log(`ReserveInfo ${safeJsonStringify(reserveInfo)}`)

	const totalSupply = getTotalSupply(runtime)
	runtime.log(`TotalSupply ${totalSupply.toString()}`)

	const totalReserveScaled = BigInt(reserveInfo.totalReserve * 1e18)
	runtime.log(`TotalReserveScaled ${totalReserveScaled.toString()}`)

	const nativeTokenBalance = fetchNativeTokenBalance(
		runtime,
		runtime.config.evms[0],
		runtime.config.evms[0].tokenAddress,
	)
	runtime.log(`NativeTokenBalance ${nativeTokenBalance.toString()}`)

	updateReserves(runtime, totalSupply, totalReserveScaled)

	return reserveInfo.totalReserve.toString()
}

const getLastMessage = (
	runtime: Runtime<Config>,
	evmConfig: Config['evms'][0],
	emitter: string,
): string => {
	const network = getNetwork({
		chainFamily: 'evm',
		chainSelectorName: evmConfig.chainSelectorName,
		isTestnet: true,
	})

	if (!network) {
		throw new Error(`Network not found for chain selector name: ${evmConfig.chainSelectorName}`)
	}

	const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector)

	// Encode the contract call data for getLastMessage
	const callData = encodeFunctionData({
		abi: MessageEmitter,
		functionName: 'getLastMessage',
		args: [emitter as Address],
	})

	const contractCall = evmClient
		.callContract(runtime, {
			call: encodeCallMsg({
				from: zeroAddress,
				to: evmConfig.messageEmitterAddress as Address,
				data: callData,
			}),
			blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
		})
		.result()

	// Decode the result
	const message = decodeFunctionResult({
		abi: MessageEmitter,
		functionName: 'getLastMessage',
		data: bytesToHex(contractCall.data),
	})

	return message
}

const onCronTrigger = (runtime: Runtime<Config>, payload: CronPayload): string => {
	if (!payload.scheduledExecutionTime) {
		throw new Error('Scheduled execution time is required')
	}

	runtime.log('Running CronTrigger')

	// return doPOR(runtime)
	return incrementCounter(runtime)
}

const onLogTrigger = (runtime: Runtime<Config>, payload: EVMLog): string => {
	runtime.log('Running LogTrigger')

	const topics = payload.topics

	if (topics.length < 3) {
		runtime.log('Log payload does not contain enough topics')
		throw new Error(`log payload does not contain enough topics ${topics.length}`)
	}

	// topics[1] is a 32-byte topic, but the address is the last 20 bytes
	const emitter = bytesToHex(topics[1].slice(12))
	runtime.log(`Emitter ${emitter}`)

	const message = getLastMessage(runtime, runtime.config.evms[0], emitter)

	runtime.log(`Message retrieved from the contract ${message}`)

	return message
}

const initWorkflow = (config: Config) => {
	const cronTrigger = new cre.capabilities.CronCapability()
	const network = getNetwork({
		chainFamily: 'evm',
		chainSelectorName: config.evms[0].chainSelectorName,
		isTestnet: true,
	})

	if (!network) {
		throw new Error(
			`Network not found for chain selector name: ${config.evms[0].chainSelectorName}`,
		)
	}

	const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector)

	return [
		cre.handler(
			cronTrigger.trigger({
				schedule: config.schedule,
			}),
			onCronTrigger,
		),
		cre.handler(
			evmClient.logTrigger({
				addresses: [config.evms[0].messageEmitterAddress],
			}),
			onLogTrigger,
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
