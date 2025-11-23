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
import { Liquidator } from '../contracts/abi'

const configSchema = z.object({
	schedule: z.string(),
	url: z.string(),
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

	// Encode the payload for setPosition: (user, isLiquidatable, collateralAmount)
	// We'll set isLiquidatable to true and some collateral amount (e.g. 100)
	const encodedPayload = encodeAbiParameters(
		[{ type: 'address' }, { type: 'bool' }, { type: 'uint256' }],
		[userAddress as Address, true, 100n]
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
			receiver: evmConfig.setPositionProxyAddress,
			report: reportResponse,
			gasConfig: {
				gasLimit: evmConfig.gasLimit,
			},
		})
		.result()

	runtime.log(`Write report (Set Position) transaction succeeded at txHash: ${JSON.stringify(runtime.config.evms)}`)

	const txStatus = resp.txStatus

	if (txStatus !== TxStatus.SUCCESS) {
		throw new Error(`Failed to write report: ${resp.errorMessage || txStatus}`)
	}

	let txHash = new Uint8Array(32)
	if (resp.txHash) {
		txHash = new Uint8Array(resp.txHash)
	}

	runtime.log(`Write report (Set Position) transaction succeeded at txHash: ${bytesToHex(txHash)}`)

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

	// Encode the payload for liquidateCollateral: (user)
	const encodedPayload = encodeAbiParameters(
		[{ type: 'address' }],
		[userAddress as Address]
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
			receiver: evmConfig.liquidateCollateralProxyAddress,
			report: reportResponse,
			gasConfig: {
				gasLimit: evmConfig.gasLimit,
			},
		})
		.result()

	runtime.log(`Write report (Liquidate Collateral) transaction succeeded at txHash: ${JSON.stringify(runtime.config.evms)}`)

	const txStatus = resp.txStatus

	if (txStatus !== TxStatus.SUCCESS) {
		throw new Error(`Failed to write report: ${resp.errorMessage || txStatus}`)
	}

	let txHash = new Uint8Array(32)
	if (resp.txHash) {
		txHash = new Uint8Array(resp.txHash)
	}

	runtime.log(`Write report (Liquidate Collateral) transaction succeeded at txHash: ${bytesToHex(txHash)}`)

	return bytesToHex(txHash)
}

const processLiquidation = (runtime: Runtime<Config>): string => {
	// Use a dummy user address for demonstration. In a real scenario, this might come from a list or event.
	// Using the sender address from config as the target user for simplicity
	const targetUser = runtime.config.evms[0].senderAddress

	const liquidatable = isLiquidatable(runtime, targetUser)
	runtime.log(`User ${targetUser} liquidatable status: ${liquidatable}`)

	if (!liquidatable) {
		return setPosition(runtime, targetUser)
	} else {
		return liquidateCollateral(runtime, targetUser)
	}
}

const onCronTrigger = (runtime: Runtime<Config>, payload: CronPayload): string => {
	if (!payload.scheduledExecutionTime) {
		throw new Error('Scheduled execution time is required')
	}

	runtime.log('Running CronTrigger')

	return processLiquidation(runtime)
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
