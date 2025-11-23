import {
	bytesToHex,
	cre,
	encodeCallMsg,
	getNetwork,
	hexToBase64,
	LAST_FINALIZED_BLOCK_NUMBER,
	Runner,
	type Runtime,
	TxStatus,
	type CronPayload
} from '@chainlink/cre-sdk'
import { type Address, decodeFunctionResult, encodeFunctionData, encodeAbiParameters, zeroAddress } from 'viem'
import { z } from 'zod'
import { Counter } from '../contracts/abi'

const configSchema = z.object({
	schedule: z.string(),
	url: z.string(),
	evms: z.array(
		z.object({
			proxyAddress: z.string(),
			counterAddress: z.string(),
			chainSelectorName: z.string(),
			gasLimit: z.string(),
			senderAddress: z.string(),
		}),
	),
})

type Config = z.infer<typeof configSchema>

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

	const nextValue = counterValue + 1n

	const network = getNetwork({
		chainFamily: 'evm',
		chainSelectorName: evmConfig.chainSelectorName,
		isTestnet: true,
	})

	if (!network) {
		throw new Error(`Network not found for chain selector name: ${evmConfig.chainSelectorName}`)
	}

	const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector)

	// Encode the uint256 payload for the report
	const encodedPayload = encodeAbiParameters(
		[{ type: 'uint256' }],
		[nextValue]
	)

	// Step 1: Generate report using consensus capability
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
			receiver: evmConfig.proxyAddress,
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

	let txHash = new Uint8Array(32)
	if (resp.txHash) {
		txHash = new Uint8Array(resp.txHash)
	}

	runtime.log(`Write report transaction succeeded at txHash: ${bytesToHex(txHash)}`)

	return bytesToHex(txHash)
}

const onCronTrigger = (runtime: Runtime<Config>, payload: CronPayload): string => {
	if (!payload.scheduledExecutionTime) {
		throw new Error('Scheduled execution time is required')
	}

	runtime.log('Running CronTrigger')

	return incrementCounter(runtime)
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
