import {
  AssetValue,
  AztecSdk,
  EthAddress,
  EthereumProvider,
  GrumpkinAddress,
  TxSettlementTime,
  TxId,
  Web3Signer,
  BridgeCallData,
  Signer,
  AztecSdkUser,
} from "@aztec/sdk";

const privateKeyMessage = Buffer.from(
  `Sign this message to generate your Aztec Privacy Key. This key lets the application decrypt your balance on Aztec.\n\nIMPORTANT: Only sign this message if you trust the application.`
);

const spendingKeyMessage = Buffer.from(
  `Sign this message to generate your Aztec Spending Key. This key lets the application spend your funds on Aztec.\n\nIMPORTANT: Only sign this message if you trust the application.`
);

export async function createSpendingKey(
  provider: EthereumProvider,
  sdk: AztecSdk
) {
  const privateKey = await createSigningKey(provider, spendingKeyMessage);
  const publicKey = await sdk.derivePublicKey(privateKey);
  return { privateKey, publicKey };
}

export async function createPrivacyKey(
  provider: EthereumProvider,
  sdk: AztecSdk
) {
  const privateKey = await createSigningKey(provider, privateKeyMessage);
  const publicKey = await sdk.derivePublicKey(privateKey);
  return { privateKey, publicKey };
}

export async function createArbitraryDeterministicKey(
  provider: EthereumProvider,
  sdk: AztecSdk,
  message: string
) {
  const messageToSign = Buffer.from(message);
  const privateKey = await createSigningKey(provider, messageToSign);
  const publicKey = await sdk.derivePublicKey(privateKey);
  return { privateKey, publicKey };
}

const createSigningKey = async (
  provider: EthereumProvider,
  message: Buffer
) => {
  const signer = new Web3Signer(provider);
  const ethAddress = (await provider.request({ method: "eth_accounts" }))[0];
  const signedMessage = await signer.signMessage(message, ethAddress);
  return signedMessage.slice(0, 32);
};

export async function depositEthToAztec(
  depositor: EthAddress,
  recipient: GrumpkinAddress,
  tokenQuantity: bigint,
  settlementTime: TxSettlementTime,
  sdk: AztecSdk
): Promise<TxId> {
  const tokenAssetId = sdk.getAssetIdBySymbol("ETH");
  const tokenDepositFee = (await sdk.getDepositFees(tokenAssetId))[
    settlementTime
  ];
  const tokenAssetValue: AssetValue = {
    assetId: tokenAssetId,
    value: tokenQuantity,
  };
  const tokenDepositController = sdk.createDepositController(
    depositor,
    tokenAssetValue,
    tokenDepositFee,
    recipient,
    true
  );
  await tokenDepositController.createProof();
  await tokenDepositController.sign();
  console.log((await tokenDepositController.getPendingFunds()))
  if ((await tokenDepositController.getPendingFunds()) < tokenQuantity) {
    await tokenDepositController.depositFundsToContract();
    await tokenDepositController.awaitDepositFundsToContract();
  }
  let txId = await tokenDepositController.send();
  return txId;
}

export async function registerAccount(
  userId: GrumpkinAddress,
  alias: string,
  accountPrivateKey: Buffer,
  newSigner: GrumpkinAddress,
  recoveryPublicKey: GrumpkinAddress,
  tokenAddress: EthAddress,
  tokenQuantity: bigint,
  settlementTime: TxSettlementTime,
  depositor: EthAddress,
  sdk: AztecSdk
): Promise<TxId> {
  const assetId = sdk.getAssetIdByAddress(tokenAddress);
  const deposit = { assetId, value: tokenQuantity };
  const txFee = (await sdk.getRegisterFees(assetId))[settlementTime];

  const controller = await sdk.createRegisterController(
    userId,
    alias,
    accountPrivateKey,
    newSigner,
    recoveryPublicKey,
    deposit,
    txFee,
    depositor
    // optional feePayer requires an Aztec Signer to pay the fee
  );

  await controller.depositFundsToContract();
  await controller.awaitDepositFundsToContract();

  await controller.createProof();
  await controller.sign();
  let txId = await controller.send();
  return txId;
}

export async function aztecConnect(
  user: AztecSdkUser,
  userSigner: Signer,
  bridgeId: number,
  inputAssetAAmount: bigint,
  inputAssetASymbol: string,
  outputAssetASymbol: string,
  inputAssetBSymbol: string | undefined,
  outputAssetBSymbol: string | undefined,
  auxData: number,
  settlementTime: TxSettlementTime,
  sdk: AztecSdk
): Promise<TxId> {
  // Initiate bridge call data parameters
  const inputAssetIdA = sdk.getAssetIdBySymbol(inputAssetASymbol.toUpperCase());
  const outputAssetIdA = sdk.getAssetIdBySymbol(outputAssetASymbol.toUpperCase());
  let inputAssetIdB: number | undefined;
  let outputAssetIdB: number | undefined;
  if (inputAssetBSymbol !== undefined) {
    inputAssetIdB = sdk.getAssetIdBySymbol(inputAssetBSymbol.toUpperCase());
  } else {
    inputAssetIdB = inputAssetBSymbol;
  }
  if (outputAssetBSymbol !== undefined) {
    outputAssetIdB = sdk.getAssetIdBySymbol(outputAssetBSymbol.toUpperCase());
  } else {
    outputAssetIdB = outputAssetBSymbol;
  }

  const bridgeCallData = new BridgeCallData(
    bridgeId,
    inputAssetIdA,
    outputAssetIdA,
    inputAssetIdB,
    outputAssetIdB,
    auxData,
  );

  // Initiate controller parameters
  const assetValue: AssetValue = { assetId: inputAssetIdA, value: inputAssetAAmount };
  const fee = (await sdk.getDefiFees(bridgeCallData))[settlementTime];

  const controller = sdk.createDefiController(
    user.id,
    userSigner,
    bridgeCallData,
    assetValue,
    fee
  );

  await controller.createProof();
  return await controller.send();
}